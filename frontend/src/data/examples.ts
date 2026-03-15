export interface Example {
  name: string;
  description: string;
  source: string;
  driver: string;
}

export const examples: readonly Example[] = [
  {
    name: "Fibonacci (Recursive)",
    description: "Classic recursive Fibonacci implementation",
    source: `\
pub fn fibonacci(n: u64) -> u64 {
    if n <= 1 {
        n
    } else {
        fibonacci(n - 1) + fibonacci(n - 2)
    }
}

extern "C" trampoline "fibonacci_ffi" = fibonacci;`,
    driver: `\
for i in 0u64..10 {
    println!("fib({i}) = {}", fibonacci_ffi(i));
}`,
  },
  {
    name: "Fibonacci (Iterative)",
    description: "Tail-recursive Fibonacci with accumulators",
    source: `\
fn fibonacci_iter_impl(n: u64, acc0: u64, acc1: u64) -> u64 {
    if n == 0 {
        acc0
    } else {
        fibonacci_iter_impl(n - 1, acc1, acc0 + acc1)
    }
}

pub fn fibonacci_iter(n: u64) -> u64 {
    fibonacci_iter_impl(n, 0, 1)
}

extern "C" trampoline "fibonacci_iter_ffi" = fibonacci_iter;`,
    driver: `\
for i in 0u64..20 {
    println!("fib({i}) = {}", fibonacci_iter_ffi(i));
}`,
  },
  {
    name: "Fibonacci (Matrix)",
    description: "O(log n) Fibonacci via matrix exponentiation",
    source: `\
struct Matrix<T : Num> {
    m00: T,
    m01: T,
    m10: T,
    m11: T
}

fn matmul<T : Num>(a : Matrix<T>, b : Matrix<T>) -> Matrix<T> {
    let m00 = a.m00 * b.m00 + a.m01 * b.m10;
    let m01 = a.m00 * b.m01 + a.m01 * b.m11;
    let m10 = a.m10 * b.m00 + a.m11 * b.m10;
    let m11 = a.m10 * b.m01 + a.m11 * b.m11;
    Matrix<T> { m00 : m00, m01 : m01, m10 : m10, m11 : m11 }
}

fn fibonacci_logarithmic_impl<T : Integral>(
    n: T,
    a: Matrix<T>,
    b: Matrix<T>
) -> T {
    if n == 0 {
        a.m01
    } else {
        if n % 2 == 1 {
            fibonacci_logarithmic_impl<T>(
                n / 2,
                matmul(a, b),
                matmul<T>(b, b)
            )
        } else {
            fibonacci_logarithmic_impl<_>(
                n / 2,
                a,
                matmul<T>(b, b)
            )
        }
    }
}

fn fibonacci<T : Integral>(n : T) -> T {
    let x = Matrix { m00 : 0, m01 : 1, m10 : 1, m11 : 1 };
    let eye = Matrix { m00 : 1, m01 : 0, m10 : 0, m11 : 1 };
    fibonacci_logarithmic_impl(n, eye, x)
}

extern "C" trampoline "fibonacci_ffi" = fibonacci<u64>;`,
    driver: `\
for i in 0u64..10 {
    println!("fib({i}) = {}", fibonacci_ffi(i));
}`,
  },
  {
    name: "Tree Count Leaves",
    description: "Pattern matching on a binary tree ADT",
    source: `\
enum Tree {
    Leaf(i32),
    Node(Tree, Tree)
}

fn count_leaves(t : Tree) -> i32 {
    match t {
        Tree::Leaf(_) => 1,
        Tree::Node(l, r) => count_leaves(l) + count_leaves(r)
    }
}

fn make_leaf(v : i32) -> Tree {
    Tree::Leaf{v}
}

fn make_node(l : Tree, r : Tree) -> Tree {
    Tree::Node{l, r}
}

extern "C" trampoline "make_leaf" = make_leaf;
extern "C" trampoline "make_node" = make_node;
extern "C" trampoline "count_leaves" = count_leaves;`,
    driver: `\
// Build: Node(Leaf(1), Node(Leaf(2), Leaf(3)))
let tree = make_node(
    make_leaf(1),
    make_node(make_leaf(2), make_leaf(3)),
);
println!("count_leaves = {}", count_leaves(tree));`,
  },
  {
    name: "Closures",
    description: "First-class closures: captures, partial application, and higher-order functions",
    source: `\
fn apply_i32(f : i32 -> i32, x : i32) -> i32 {
    f(x)
}

fn apply_bool(f : bool -> i32, x : bool) -> i32 {
    f(x)
}

// basic closure call
pub fn test_basic_call() -> i32 {
    let add_one = |x : i32| x + 1;
    apply_i32(add_one, 41)
}
extern "C" trampoline "test_basic_call_ffi" = test_basic_call;

// closure with capture
pub fn test_capture() -> i32 {
    let offset = 10;
    let add_offset = |x : i32| x + offset;
    apply_i32(add_offset, 32)
}
extern "C" trampoline "test_capture_ffi" = test_capture;

// partial application
pub fn test_partial() -> i32 {
    let choose = |a : i32, b : bool| if (b) { a } else { 0 };
    let choose_100 = choose(100);
    apply_bool(choose_100, true)
}
extern "C" trampoline "test_partial_ffi" = test_partial;

// closure returning closure (higher-order)
fn make_adder(n : i32) -> i32 -> i32 {
    |x : i32| x + n
}

pub fn test_higher_order() -> i32 {
    let add5 = make_adder(5);
    apply_i32(add5, 37)
}
extern "C" trampoline "test_higher_order_ffi" = test_higher_order;

// nested closure calls
pub fn test_nested() -> i32 {
    let double = |x : i32| x * 2;
    let inc    = |x : i32| x + 1;
    apply_i32(inc, apply_i32(double, 20))
}
extern "C" trampoline "test_nested_ffi" = test_nested;`,
    driver: `\
println!("basic call:    {}", test_basic_call_ffi());
println!("capture:       {}", test_capture_ffi());
println!("partial app:   {}", test_partial_ffi());
println!("higher-order:  {}", test_higher_order_ffi());
println!("nested:        {}", test_nested_ffi());`,
  },
  {
    name: "Closure Multiplicity",
    description: "Closures reused multiple times and shared captures with reference counting",
    source: `\
struct Box {
    x : i32
}

fn apply1(f : i32 -> i32, x : i32) -> i32 {
    f(x)
}

fn get_x(b : Box) -> i32 {
    b.x
}

// same closure called multiple times
pub fn test_closure_reuse() -> i32 {
    let add_one = |x : i32| x + 1;
    let a = apply1(add_one, 10);
    let b = apply1(add_one, 20);
    let c = apply1(add_one, 30);
    a + b + c
}
extern "C" trampoline "test_closure_reuse_ffi" = test_closure_reuse;

// captured RC value used both inside and outside closure
pub fn test_capture_and_use() -> i32 {
    let val = Box { x: 7 };
    let use_val = |x : i32| x + val.x;
    let inside = apply1(use_val, 10);
    let outside = val.x * 5;
    inside + outside
}
extern "C" trampoline "test_capture_and_use_ffi" = test_capture_and_use;

// multiple closures capture the same RC variable
pub fn test_shared_capture() -> i32 {
    let shared = Box { x: 100 };
    let add_shared = |x : i32| x + shared.x;
    let sub_shared = |x : i32| x - shared.x;
    let a = apply1(add_shared, 10);
    let b = apply1(sub_shared, 210);
    a + b
}
extern "C" trampoline "test_shared_capture_ffi" = test_shared_capture;

// partial application result used multiple times
fn make_adder(n : i32) -> i32 -> i32 {
    |x : i32| x + n
}

pub fn test_partial_reuse() -> i32 {
    let add5 = make_adder(5);
    let a = apply1(add5, 10);
    let b = apply1(add5, 20);
    a + b
}
extern "C" trampoline "test_partial_reuse_ffi" = test_partial_reuse;`,
    driver: `\
println!("closure reuse:    {}", test_closure_reuse_ffi());
println!("capture and use:  {}", test_capture_and_use_ffi());
println!("shared capture:   {}", test_shared_capture_ffi());
println!("partial reuse:    {}", test_partial_reuse_ffi());`,
  },
  {
    name: "List Sum",
    description: "Recursive sum over a generic linked list",
    source: `\
enum List<T> {
    Nil,
    Cons(T, List<T>)
}

fn sum(list : List<i32>) -> i32 {
    match list {
        List::Nil => 0,
        List::Cons(x, xs) => x + sum(xs)
    }
}

fn nil() -> List<i32> {
    List::Nil{}
}

fn cons(x : i32, xs : List<i32>) -> List<i32> {
    List::Cons{x, xs}
}

extern "C" trampoline "nil" = nil;
extern "C" trampoline "cons" = cons;
extern "C" trampoline "sum" = sum;`,
    driver: `\
// Build: [1, 2, 3, 4, 5]
let list = cons(1, cons(2, cons(3, cons(4, cons(5, nil())))));
println!("sum([1,2,3,4,5]) = {}", sum(list));`,
  },
  {
    name: "NBE-HOAS",
    description:
      "Normalization by Evaluation with Higher-Order Abstract Syntax — normalizes Church numerals using closures as binders",
    source: `\
enum Term {
    Var(i32),
    Lam(i32, Term),
    App(Term, Term),
    Let(i32, Term, Term)
}

enum Value {
    VVar(i32),
    VApp(Value, Value),
    VLam(i32, Value -> Value)
}

enum Env {
    EnvCons(i32, Value, Env),
    EnvNil
}

enum Names {
    NameCons(i32, Names),
    NameNil
}

fn max_of_names(n: Names, acc: i32) -> i32 {
    match n {
        Names::NameCons(id, n1) => {
            let next = if acc > id { acc } else { id };
            max_of_names(n1, next)
        },
        Names::NameNil => acc
    }
}

fn names_of_env(env: Env, acc: Names) -> Names {
    match env {
        Env::EnvCons(id, _, env1) => names_of_env(env1, Names::NameCons{id, acc}),
        Env::EnvNil => acc
    }
}

fn fresh(n: Names) -> i32 {
    max_of_names(n, 0) + 1
}

fn lookup(env: Env, id: i32) -> Value {
    match env {
        Env::EnvCons(id1, v, env1) =>
            if id == id1 { v } else { lookup(env1, id) },
        Env::EnvNil => Value::VVar{id}
    }
}

fn eval(env: Env, x: Term) -> Value {
    match x {
        Term::Var(id) => lookup(env, id),
        Term::App(t, u) => vapp(eval(env, t), eval(env, u)),
        Term::Lam(x, t) => Value::VLam{x, |u: Value| eval(Env::EnvCons{x, u, env}, t)},
        Term::Let(x, t, u) => eval(Env::EnvCons{x, eval(env, t), env}, u)
    }
}

fn vapp(v1: Value, v2: Value) -> Value {
    match v1 {
        Value::VLam(_, body) => body(v2),
        _ => Value::VApp{v1, v2}
    }
}

fn quote(n: Names, v: Value) -> Term {
    match v {
        Value::VVar(i) => Term::Var{i},
        Value::VApp(v1, v2) => Term::App{quote(n, v1), quote(n, v2)},
        Value::VLam(_, f) => {
            let y = fresh(n);
            Term::Lam{y, quote(Names::NameCons{y, n}, f(Value::VVar{y}))}
        }
    }
}

fn norm_form(env: Env, t: Term) -> Term {
    quote(names_of_env(env, Names::NameNil), eval(env, t))
}

// Church numeral 5: \\f. \\x. f (f (f (f (f x))))
fn five() -> Term {
    Term::Lam{
        0,
        Term::Lam{
            1,
            Term::App{
                Term::Var{0},
                Term::App{
                    Term::Var{0},
                    Term::App{
                        Term::Var{0},
                        Term::App{
                            Term::Var{0},
                            Term::App{Term::Var{0}, Term::Var{1}}
                        }
                    }
                }
            }
        }
    }
}

// Church addition: \\m. \\n. \\f. \\x. m f (n f x)
fn add() -> Term {
    Term::Lam{
        0,
        Term::Lam{
            1,
            Term::Lam{
                2,
                Term::Lam{
                    3,
                    Term::App{
                        Term::App{Term::Var{0}, Term::Var{2}},
                        Term::App{Term::App{Term::Var{1}, Term::Var{2}}, Term::Var{3}}
                    }
                }
            }
        }
    }
}

// Church multiplication: \\m. \\n. \\f. \\x. m (n f) x
fn mul() -> Term {
    Term::Lam{
        0,
        Term::Lam{
            1,
            Term::Lam{
                2,
                Term::Lam{
                    3,
                    Term::App{
                        Term::App{Term::Var{0}, Term::App{Term::Var{1}, Term::Var{2}}},
                        Term::Var{3}
                    }
                }
            }
        }
    }
}

fn ten() -> Term {
    let x = five();
    let y = add();
    Term::App{Term::App{y, x}, x}
}

fn hundred() -> Term {
    let x = ten();
    let y = mul();
    Term::App{Term::App{y, x}, x}
}

fn thousand() -> Term {
    let x = hundred();
    let z = ten();
    let y = mul();
    Term::App{Term::App{y, x}, z}
}

// Count applications in the normal form to recover the integer
fn nf_to_int(t: Term, acc: i32) -> i32 {
    match t {
        Term::Lam(_, x) => nf_to_int(x, acc),
        Term::App(_, x) => nf_to_int(x, acc + 1),
        _ => acc
    }
}

fn nbe_test() -> i32 {
    let t = thousand();
    let n = norm_form(Env::EnvNil, t);
    nf_to_int(n, 0)
}

extern "C" trampoline "nbe_test_ffi" = nbe_test;`,
    driver: `\
let result = nbe_test_ffi();
println!("NBE of Church 1000 = {result}");`,
  },
  {
    name: "Region",
    description:
      "Region-based memory management with regional structs, flex/rigid cells, and region scopes",
    source: `\
struct [regional] Cell<T> {
    value: T
}

struct [regional] Container<T> {
    cell: [field] Cell<T>
}

fn trivial() -> u64 {
    regional {
        1
    }
}

fn freeze_cell() -> Cell<u64> {
    regional {
        Cell{value: 1}
    }
}

fn freeze_cell_with_let_expr() -> Cell<u64> {
    regional {
        let x : [flex] Cell<u64> = regional_function(42);
        x
    }
}

regional fn regional_function(x : u64) -> [flex] Cell<u64> {
    Cell{value: x}
}

extern "C" trampoline "trivial" = trivial;`,
    driver: `\
println!("trivial = {}", trivial());`,
  },
];
