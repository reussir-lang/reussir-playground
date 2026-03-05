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
];
