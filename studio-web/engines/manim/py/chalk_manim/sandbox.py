"""Static guardrails and a restricted builtins table for LLM-authored Manim code.

This is defence in depth, not an OS sandbox. The Node runner already isolates the
process (scrubbed environment, wall-clock timeout, process-group kill). On top of that,
code is rejected before execution when it imports modules, evaluates strings, touches
files, or reaches private attributes such as ``__class__`` or ``__globals__``. Accepted
code runs with ``safe_builtins()`` as its only builtins.
"""

import ast
import builtins

MAX_CODE_CHARS = 20_000

FORBIDDEN_NODES = (ast.Import, ast.ImportFrom, ast.AsyncFunctionDef, ast.Await)

FORBIDDEN_NAMES = frozenset(
    {
        "__import__",
        "__builtins__",
        "exec",
        "eval",
        "compile",
        "open",
        "input",
        "breakpoint",
        "globals",
        "locals",
        "vars",
        "dir",
        "help",
        "memoryview",
        "exit",
        "quit",
        "setattr",
        "delattr",
    }
)

_ALLOWED_BUILTINS = (
    "abs",
    "all",
    "any",
    "bool",
    "dict",
    "enumerate",
    "filter",
    "float",
    "int",
    "isinstance",
    "len",
    "list",
    "map",
    "max",
    "min",
    "print",
    "range",
    "reversed",
    "round",
    "set",
    "sorted",
    "str",
    "sum",
    "tuple",
    "zip",
    "Exception",
    "ValueError",
    "TypeError",
    "ZeroDivisionError",
    "__build_class__",
)


class SandboxError(ValueError):
    """Raised when generated code fails validation."""


def validate(source):
    """Return a list of human-readable violations. An empty list means accepted."""
    if not isinstance(source, str):
        return ["code must be a string"]
    if len(source) > MAX_CODE_CHARS:
        return [f"code exceeds {MAX_CODE_CHARS} characters"]
    try:
        tree = ast.parse(source, mode="exec")
    except SyntaxError as exc:
        return [f"syntax error on line {exc.lineno}: {exc.msg}"]
    problems = []
    for node in ast.walk(tree):
        line = getattr(node, "lineno", "?")
        if isinstance(node, FORBIDDEN_NODES):
            problems.append(f"line {line}: {type(node).__name__} is not allowed")
        elif isinstance(node, ast.Name) and (
            node.id in FORBIDDEN_NAMES or node.id.startswith("__")
        ):
            problems.append(f"line {line}: name '{node.id}' is not allowed")
        elif isinstance(node, ast.Attribute) and node.attr.startswith("_"):
            problems.append(f"line {line}: private attribute '{node.attr}' is not allowed")
        elif (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id in ("getattr", "hasattr")
            and len(node.args) >= 2
            and isinstance(node.args[1], ast.Constant)
            and isinstance(node.args[1].value, str)
            and node.args[1].value.startswith("_")
        ):
            problems.append(f"line {line}: private attribute '{node.args[1].value}' is not allowed")
    return problems


def check_or_raise(source):
    problems = validate(source)
    if problems:
        raise SandboxError("rejected generated code: " + "; ".join(problems[:5]))


def _safe_getattr(obj, name, *default):
    """getattr that refuses private names, so string lookups cannot reach dunders."""
    if not isinstance(name, str) or name.startswith("_"):
        raise AttributeError(f"access to attribute {name!r} is not allowed")
    return getattr(obj, name, *default)


def safe_builtins():
    """Fresh allowlisted builtins table for one exec() call."""
    table = {name: getattr(builtins, name) for name in _ALLOWED_BUILTINS if hasattr(builtins, name)}
    table["getattr"] = _safe_getattr
    return table
