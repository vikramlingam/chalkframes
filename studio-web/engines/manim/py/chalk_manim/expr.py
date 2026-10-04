"""Restricted math-expression grammar. No eval(), no exec(), no attribute access.

    expr   := term (('+'|'-') term)*
    term   := unary (('*'|'/') unary)*          # implicit multiplication: 2x, 3(x+1)
    unary  := ('-'|'+') unary | power
    power  := atom (('^'|'**') unary)?
    atom   := NUMBER | 'x' | CONST | FUNC '(' expr ')' | '(' expr ')'
"""

import math
import re

MAX_LEN = 200
FUNCS = {
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "exp": math.exp,
    "log": math.log,
    "ln": math.log,
    "sqrt": math.sqrt,
    "abs": abs,
}
CONSTS = {"pi": math.pi, "e": math.e}
_TOKEN = re.compile(r"\s*(?:(\d+\.?\d*|\.\d+)|(\*\*|[-+*/^()])|([A-Za-z_]+))")


class ExprError(ValueError):
    pass


def _tokenize(src):
    if not isinstance(src, str) or not src.strip():
        raise ExprError("empty expression")
    if len(src) > MAX_LEN:
        raise ExprError("expression too long")
    pos, out = 0, []
    while pos < len(src):
        if src[pos:].strip() == "":
            break
        m = _TOKEN.match(src, pos)
        if not m:
            raise ExprError(f"unexpected character at {pos}")
        num, op, name = m.groups()
        if num is not None:
            out.append(("num", float(num)))
        elif op is not None:
            out.append(("op", "^" if op == "**" else op))
        else:
            name = name.lower()
            if name == "x" or name in CONSTS or name in FUNCS:
                out.append(("name", name))
            else:
                raise ExprError(f"unknown identifier '{name}'")
        pos = m.end()
    return out


class _Parser:
    def __init__(self, tokens):
        self.t = tokens
        self.i = 0

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else (None, None)

    def take(self):
        tok = self.peek()
        self.i += 1
        return tok

    def parse(self):
        node = self.expr()
        if self.i != len(self.t):
            raise ExprError("trailing tokens")
        return node

    def expr(self):
        node = self.term()
        while self.peek() in (("op", "+"), ("op", "-")):
            op = self.take()[1]
            rhs = self.term()
            node = ("add" if op == "+" else "sub", node, rhs)
        return node

    def _starts_atom(self):
        kind, val = self.peek()
        return kind in ("num", "name") or (kind == "op" and val == "(")

    def term(self):
        node = self.unary()
        while True:
            if self.peek() in (("op", "*"), ("op", "/")):
                op = self.take()[1]
                node = ("mul" if op == "*" else "div", node, self.unary())
            elif self._starts_atom():  # implicit multiplication
                node = ("mul", node, self.unary())
            else:
                return node

    def unary(self):
        if self.peek() == ("op", "-"):
            self.take()
            return ("neg", self.unary())
        if self.peek() == ("op", "+"):
            self.take()
            return self.unary()
        return self.power()

    def power(self):
        base = self.atom()
        if self.peek() == ("op", "^"):
            self.take()
            return ("pow", base, self.unary())
        return base

    def atom(self):
        kind, val = self.take()
        if kind == "num":
            return ("num", val)
        if kind == "name":
            if val == "x":
                return ("x",)
            if val in CONSTS:
                return ("num", CONSTS[val])
            if self.take() != ("op", "("):
                raise ExprError(f"'{val}' must be called with parentheses")
            inner = self.expr()
            if self.take() != ("op", ")"):
                raise ExprError("missing ')'")
            return ("call", val, inner)
        if (kind, val) == ("op", "("):
            inner = self.expr()
            if self.take() != ("op", ")"):
                raise ExprError("missing ')'")
            return inner
        raise ExprError("unexpected token")


def _evaluate(node, x):
    tag = node[0]
    if tag == "num":
        return node[1]
    if tag == "x":
        return x
    if tag == "neg":
        return -_evaluate(node[1], x)
    if tag == "call":
        return FUNCS[node[1]](_evaluate(node[2], x))
    a, b = _evaluate(node[1], x), _evaluate(node[2], x)
    if tag == "add":
        return a + b
    if tag == "sub":
        return a - b
    if tag == "mul":
        return a * b
    if tag == "div":
        return a / b
    if tag == "pow":
        return a**b
    raise ExprError("bad node")


def compile_expr(src):
    """Parse once, return f(x) -> float. NaN / inf / domain errors become float('nan')."""
    tree = _Parser(_tokenize(src)).parse()

    def f(x):
        try:
            v = _evaluate(tree, float(x))
            if isinstance(v, complex):
                return float("nan")
            return v if math.isfinite(v) else float("nan")
        except (ValueError, ZeroDivisionError, OverflowError):
            return float("nan")

    return f
