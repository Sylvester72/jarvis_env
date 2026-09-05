"""Shared HTTPS fetch helper with an honest TLS fallback for this PC.

Some Windows machines run an antivirus that re-signs every HTTPS connection
with its own root CA (this one presents "Avast Web/Mail Shield Root"). Python's
`requests` does not trust that CA by default, so a fully-verified request fails
with an SSL certificate error even though the sites are fine - and any feature
that needs the internet (weather, news) would silently die.

This helper always tries a fully-verified request first. Only when that fails
with a certificate error does it retry the SAME request unverified, and it logs
a plain-language note so the fallback is never hidden. Set
config.ALLOW_UNVERIFIED_HTTPS_FALLBACK to False to refuse the fallback entirely.
"""

import warnings

import requests

from jarvis import config
from jarvis.state import push_history

_FALLBACK_NOTE = (
    "(HTTPS certificate check failed - your antivirus appears to be re-signing "
    "internet connections (Avast Web/Mail Shield was detected). Retrying this "
    "request without verification so the feature still works. You can turn this "
    "off with config.ALLOW_UNVERIFIED_HTTPS_FALLBACK = False.)"
)


def fetch(url, params=None, timeout=15, **kwargs):
    """GET a URL. Returns the response (with raise_for_status applied) or None
    on failure. Verified first, unverified-on-SSLError fallback second."""
    try:
        resp = requests.get(url, params=params, timeout=timeout, verify=True, **kwargs)
        resp.raise_for_status()
        return resp
    except requests.exceptions.SSLError:
        if not config.ALLOW_UNVERIFIED_HTTPS_FALLBACK:
            push_history("(HTTPS certificate could not be verified and the "
                         "unverified fallback is disabled.)")
            return None
        push_history(_FALLBACK_NOTE)
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")  # silence urllib3's InsecureRequestWarning
                resp = requests.get(url, params=params, timeout=timeout, verify=False, **kwargs)
            resp.raise_for_status()
            return resp
        except requests.exceptions.RequestException as e:
            push_history(f"(network error for {url}: {e})")
            return None
    except requests.exceptions.RequestException as e:
        push_history(f"(network error for {url}: {e})")
        return None
