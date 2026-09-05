"""Direct math / quick answers.

'what's 47 times 12' / 'what's the square root of 144' is answered with a
computed result instead of opening Calculator or routing to the LLM.

Safety is the whole point: the expression is parsed with Python's ``ast`` module
and evaluated by walking the node tree, permitting ONLY numeric operations
(+, -, *, /, **, parentheses, and a tiny allowlist of functions like sqrt). Raw
eval()/exec() are never used on anything that came from the microphone or any
other untrusted source. Spoken words are mapped to operators first.

If the phrase can't be confidently turned into a math expression, the handler
returns None so the dispatcher falls through to the AI rather than guessing.
"""

import ast
import math
import re

from jarvis import persona

# Functions a spoken expression may call (only sqrt is reachable via word
# conversion today; anything else - bare names, attributes, dunder calls, other
# builtins - is rejected by the AST walk).
_ALLOWED_FUNCS = {"sqrt": math.sqrt}

_MAX_EXPONENT = 1000  # bounds huge powers so they can't stall the voice thread

# Spoken signals that this is a math question (sqrt handled separately).
_MATH_MARKERS = (
    "times", "divided by", "multiplied by", "plus", "minus",
    "squared", "cubed", "to the power of", "power of", "raised to",
    "percent of", "percent",
)

_MATH_PREFIX_RE = re.compile(
    r"^(?:what'?s|what\s+is|whats|calculate|compute|"
    r"how\s+much\s+is|how\s+much\s+do\s+i\s+get|"
    r"what\s+does|what\s+do)[:\s]+", re.IGNORECASE)

# "the square root of 144" / "sqrt of 144" -> "sqrt(144)" (operand is a number)
_SQRT_RE = re.compile(
    r"(?:\bthe\s+)?(?:square\s+root\s+of|sqrt\s+of|\bsqrt\b)\s+(\d+(?:\.\d+)?)")

# "10 percent of 50" -> "(10 / 100) * 50"
_PERCENT_OF_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:percent|%)\s+of\s+")

# Every character a valid expression may contain. Anything left over after this
# substitution means the phrase wasn't a math question - refuse it.
_ALLOWED_CHARS_RE = re.compile(r"\d+\.?\d*|\.\d+|sqrt|[\s+\-*/()]")


def handle_math_command(command):
    """Returns a spoken answer if this is a math question, else None so the
    dispatcher falls through to the AI."""
    if not command or not command.strip():
        return None
    expr = _extract_expression(command)
    if expr is None:
        return None
    try:
        value = _safe_eval(ast.parse(expr, mode="eval"))
    except ZeroDivisionError:
        return persona.REPLY_MATH_DIV_ZERO
    except (SyntaxError, ValueError, OverflowError, TypeError):
        return None  # can't confidently evaluate - let the AI take it
    return persona.REPLY_MATH.format(result=_format_result(value))


def _looks_like_math(c):
    if "square root" in c or "sqrt" in c or "sqroot" in c:
        return True
    if not re.search(r"\d", c):
        return False
    return any(m in c for m in _MATH_MARKERS) or "what" in c or "how much" in c


def _extract_expression(command):
    """Turn a spoken command into a pure numeric expression, or None if it can't
    be done confidently."""
    c = command.lower().strip()
    if not _looks_like_math(c):
        return None

    expr = c
    expr = _SQRT_RE.sub(r"sqrt(\1)", expr)
    expr = _PERCENT_OF_RE.sub(r"(\1 / 100) * ", expr)

    # spoken words -> operators
    expr = expr.replace("to the power of", "**")
    expr = expr.replace("raised to", "**")
    expr = expr.replace("divided by", "/")
    expr = expr.replace("multiplied by", "*")
    expr = expr.replace("times", "*")
    expr = expr.replace("squared", "**2")
    expr = expr.replace("cubed", "**3")
    expr = expr.replace("plus", "+")
    expr = expr.replace("minus", "-")
    expr = expr.replace("percent", "%")  # leftover 'percent' -> symbol; '%' is
                                         # not an allowed char so it'll be refused

    # strip leading question phrasing and small filler words
    expr = _MATH_PREFIX_RE.sub("", expr)
    expr = re.sub(r"^\s*(?:the\s+)?(?:answer\s+to\s+|result\s+of\s+|value\s+of\s+)?", "", expr)
    expr = expr.strip(" ?!.,;:")  # drop punctuation first so the word strip below works
    # strip trailing question/equality filler
    expr = re.sub(r"\s*(?:equals?|equal\s+to|is\s+equal\s+to|gives?|makes?|is|what)\s*$", "", expr)
    expr = expr.strip(" ?!.,;:")

    if not expr or not re.search(r"\d", expr):
        return None
    # Any leftover word means we didn't really understand it - refuse rather
    # than guess.
    if _ALLOWED_CHARS_RE.sub("", expr).strip():
        return None
    return expr


# ---------- safe evaluator (ast walk, never eval/exec) ----------

def _safe_eval(node):
    if isinstance(node, ast.Expression):
        return _safe_eval(node.body)
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
            return node.value
        raise ValueError("unsupported constant")
    if isinstance(node, ast.BinOp):
        left = _safe_eval(node.left)
        right = _safe_eval(node.right)
        op = type(node.op)
        if op is ast.Add:
            return left + right
        if op is ast.Sub:
            return left - right
        if op is ast.Mult:
            return left * right
        if op is ast.Div:
            if right == 0:
                raise ZeroDivisionError
            return left / right
        if op is ast.Pow:
            if isinstance(right, (int, float)) and abs(right) > _MAX_EXPONENT:
                raise ValueError("exponent too large")
            return left ** right
        raise ValueError("unsupported operator")
    if isinstance(node, ast.UnaryOp):
        value = _safe_eval(node.operand)
        op = type(node.op)
        if op is ast.UAdd:
            return +value
        if op is ast.USub:
            return -value
        raise ValueError("unsupported unary operator")
    if isinstance(node, ast.Call):
        if not (isinstance(node.func, ast.Name) and node.func.id in _ALLOWED_FUNCS):
            raise ValueError("unsupported function")
        args = [_safe_eval(a) for a in node.args]
        return _ALLOWED_FUNCS[node.func.id](*args)
    raise ValueError("unsupported expression")


def _format_result(value):
    if isinstance(value, float) and value.is_integer() and abs(value) < 1e15:
        value = int(value)
    if isinstance(value, int):
        return f"{value:,}"
    if abs(value) >= 1e15 or (value != 0 and abs(value) < 1e-6):
        return f"about {value:.2e}"
    return f"{value:.6g}"
