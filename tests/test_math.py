"""Direct math / quick answers: safe ast-based arithmetic, spoken-word
conversion, result formatting, refusal of unsafe/unknown input, and dispatcher
routing. The key guarantee: voice text is never eval()'d - only a validated
numeric expression walked via the AST is computed."""

import ast

import pytest

from jarvis import mathcalc, persona
from jarvis.commands import dispatcher


def test_times():
    assert mathcalc.handle_math_command("what's 47 times 12") == "That's 564."


def test_plus():
    assert mathcalc.handle_math_command("what is 2 plus 2") == "That's 4."


def test_square_root():
    assert mathcalc.handle_math_command("what's the square root of 144") == "That's 12."


def test_operator_precedence():
    # 2 + (3 * 4) = 14, not 20 - proves grouping is honored
    assert mathcalc.handle_math_command("what's 2 plus 3 times 4") == "That's 14."


def test_division_float():
    assert mathcalc.handle_math_command("what's 10 divided by 4") == "That's 2.5."


def test_subtraction():
    assert mathcalc.handle_math_command("how much is 5 minus 3") == "That's 2."


def test_power_word():
    assert mathcalc.handle_math_command("what's 2 to the power of 10") == "That's 1,024."


def test_squared_word():
    assert mathcalc.handle_math_command("what's 5 squared") == "That's 25."


def test_percent_of():
    assert mathcalc.handle_math_command("what's 10 percent of 50") == "That's 5."


def test_negative_numbers():
    assert mathcalc.handle_math_command("what's minus 5 times minus 5") == "That's 25."


def test_trailing_equals():
    assert mathcalc.handle_math_command("what's 3 plus 4 times 2 equals?") == "That's 11."


def test_division_by_zero():
    assert mathcalc.handle_math_command("what's 47 divided by 0") == persona.REPLY_MATH_DIV_ZERO


# ---------- fallthrough (None) for non-math / unsafe ----------

def test_non_math_returns_none():
    assert mathcalc.handle_math_command("what's the time") is None
    assert mathcalc.handle_math_command("what's the weather in paris") is None
    assert mathcalc.handle_math_command("remind me in 10 minutes") is None
    assert mathcalc.handle_math_command("set volume to 50") is None
    assert mathcalc.handle_math_command("") is None


def test_trailing_prose_refuses_not_guesses():
    # "what's 5 plus 5 is 10" has unresolved prose - refuse, don't compete
    assert mathcalc.handle_math_command("what's 5 plus 5 is 10") is None


def test_code_injection_is_rejected():
    for bad in [
        "what's __import__('os').listdir()",
        "what's 2 ** 1000000",       # exponent guard
        "what's 1; system('rm')",
        "what's eval('os')",
    ]:
        assert mathcalc.handle_math_command(bad) is None, bad


def test_pow_is_bounded():
    with pytest.raises(ValueError):
        mathcalc._safe_eval(ast.parse("2 ** 100000", mode="eval"))
    # within bounds it still works
    assert mathcalc._safe_eval(ast.parse("2 ** 10", mode="eval")) == 1024


# ---------- dispatcher routing ----------

def test_dispatcher_routes_math(isolated_memory):
    assert dispatcher.try_fixed_command("what's 47 times 12") == "That's 564."


def test_dispatcher_math_not_swallowed_by_other_handlers(isolated_memory):
    assert dispatcher.try_fixed_command("what's 3 plus 3") == "That's 6."