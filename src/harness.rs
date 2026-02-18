use regex::Regex;
use std::collections::HashMap;

struct Trampoline {
    ffi_name: String,
    reussir_fn: String,
    type_args: Vec<String>,
}

struct FuncSig {
    name: String,
    type_params: Vec<String>,
    params: Vec<(String, String)>,
    ret: Option<String>,
}

pub fn generate_harness(source: &str, driver: &str) -> Result<String, String> {
    let trampolines = parse_trampolines(source);
    let functions = parse_functions(source);

    let mut extern_decls = Vec::new();
    for t in &trampolines {
        let func = functions
            .iter()
            .find(|f| f.name == t.reussir_fn)
            .ok_or_else(|| {
                format!(
                    "Function '{}' referenced by trampoline '{}' not found",
                    t.reussir_fn, t.ffi_name
                )
            })?;
        extern_decls.push(generate_ffi_decl(t, func)?);
    }

    let extern_block = if extern_decls.is_empty() {
        String::new()
    } else {
        format!("\nextern \"C\" {{\n{}}}\n", extern_decls.join(""))
    };

    Ok(format!(
        r#"extern crate reussir_rt;
{extern_block}
fn main() {{
    unsafe {{
        {driver}
    }}
}}
"#
    ))
}

fn parse_trampolines(source: &str) -> Vec<Trampoline> {
    let re = Regex::new(
        r#"extern\s+"C"\s+trampoline\s+"(\w+)"\s*=\s*(\w+)(?:\s*<([^>]+)>)?\s*;"#,
    )
    .unwrap();
    re.captures_iter(source)
        .map(|cap| {
            let type_args = cap
                .get(3)
                .map(|m| {
                    m.as_str()
                        .split(',')
                        .map(|s| s.trim().to_string())
                        .collect()
                })
                .unwrap_or_default();
            Trampoline {
                ffi_name: cap[1].to_string(),
                reussir_fn: cap[2].to_string(),
                type_args,
            }
        })
        .collect()
}

fn parse_functions(source: &str) -> Vec<FuncSig> {
    let re = Regex::new(
        r"(?s)(?:pub\s+)?fn\s+(\w+)(?:<([^>]*)>)?\s*\(([^)]*)\)\s*(?:->\s*(\S+))?\s*\{",
    )
    .unwrap();
    re.captures_iter(source)
        .map(|cap| {
            let type_params = cap
                .get(2)
                .map(|m| {
                    m.as_str()
                        .split(',')
                        .map(|s| {
                            // Extract just the type param name (before any `:` bound)
                            s.split(':').next().unwrap().trim().to_string()
                        })
                        .collect()
                })
                .unwrap_or_default();

            let params = cap
                .get(3)
                .map(|m| {
                    let s = m.as_str().trim();
                    if s.is_empty() {
                        return Vec::new();
                    }
                    s.split(',')
                        .filter_map(|p| {
                            let p = p.trim();
                            let parts: Vec<&str> = p.splitn(2, ':').collect();
                            if parts.len() == 2 {
                                Some((
                                    parts[0].trim().to_string(),
                                    parts[1].trim().to_string(),
                                ))
                            } else {
                                None
                            }
                        })
                        .collect()
                })
                .unwrap_or_default();

            let ret = cap.get(4).map(|m| m.as_str().to_string());

            FuncSig {
                name: cap[1].to_string(),
                type_params,
                params,
                ret,
            }
        })
        .collect()
}

fn generate_ffi_decl(trampoline: &Trampoline, func: &FuncSig) -> Result<String, String> {
    let mut type_map: HashMap<&str, &str> = HashMap::new();
    for (i, tp) in func.type_params.iter().enumerate() {
        if let Some(arg) = trampoline.type_args.get(i) {
            type_map.insert(tp.as_str(), arg.as_str());
        }
    }

    let params: Vec<String> = func
        .params
        .iter()
        .map(|(name, ty)| {
            let rust_type = resolve_type(ty, &type_map);
            format!("{name}: {rust_type}")
        })
        .collect();

    let ret_str = match &func.ret {
        Some(ty) => format!(" -> {}", resolve_type(ty, &type_map)),
        None => String::new(),
    };

    Ok(format!(
        "    fn {}({}){};\n",
        trampoline.ffi_name,
        params.join(", "),
        ret_str
    ))
}

fn resolve_type(ty: &str, type_map: &HashMap<&str, &str>) -> String {
    let resolved = if let Some(&r) = type_map.get(ty) {
        r
    } else {
        ty
    };
    map_to_rust(resolved).to_string()
}

fn map_to_rust(ty: &str) -> &str {
    match ty {
        "u8" | "u16" | "u32" | "u64" | "i8" | "i16" | "i32" | "i64" | "f32" | "f64" | "bool" => {
            ty
        }
        _ => "*mut u8",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_trampoline() {
        let source = r#"
pub fn fibonacci(n: u64) -> u64 {
    if n <= 1 { n } else { fibonacci(n - 1) + fibonacci(n - 2) }
}
extern "C" trampoline "fibonacci_ffi" = fibonacci;
"#;
        let driver = r#"println!("{}", fibonacci_ffi(10));"#;
        let harness = generate_harness(source, driver).unwrap();
        assert!(harness.contains("fn fibonacci_ffi(n: u64) -> u64;"));
        assert!(harness.contains("extern crate reussir_rt;"));
        assert!(harness.contains(driver));
    }

    #[test]
    fn test_parse_generic_trampoline() {
        let source = r#"
fn fibonacci<T : Integral>(n : T) -> T {
    let x = 1;
    x
}
extern "C" trampoline "fibonacci_ffi" = fibonacci<u64>;
"#;
        let driver = "";
        let harness = generate_harness(source, driver).unwrap();
        assert!(harness.contains("fn fibonacci_ffi(n: u64) -> u64;"));
    }

    #[test]
    fn test_no_trampolines() {
        let source = r#"
fn foo() -> i32 { 42 }
"#;
        let driver = r#"println!("hello");"#;
        let harness = generate_harness(source, driver).unwrap();
        assert!(!harness.contains("extern \"C\""));
        assert!(harness.contains("extern crate reussir_rt;"));
        assert!(harness.contains(driver));
    }

    #[test]
    fn test_opaque_pointer_types() {
        let source = r#"
fn make_leaf(v : i32) -> Tree {
    v
}
fn count_leaves(t : Tree) -> i32 {
    1
}
extern "C" trampoline "make_leaf" = make_leaf;
extern "C" trampoline "count_leaves" = count_leaves;
"#;
        let driver = "";
        let harness = generate_harness(source, driver).unwrap();
        assert!(harness.contains("fn make_leaf(v: i32) -> *mut u8;"));
        assert!(harness.contains("fn count_leaves(t: *mut u8) -> i32;"));
    }
}
