export interface Example {
  name: string;
  source: string;
  driver: string;
}

export const examples: readonly Example[] = [
  {
    name: "Fibonacci (Recursive)",
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
    name: "List Sum",
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
