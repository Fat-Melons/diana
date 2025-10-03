use std::env;

fn main() {
    // Get PROXY_URL environment variable or use default
    let proxy_url = env::var("PROXY_URL")
        .unwrap_or_else(|_| "http://localhost:4000/api".to_string());
    
    // Pass the URL to the compiler as a compile-time environment variable
    println!("cargo:rustc-env=PROXY_BASE_URL={}", proxy_url);
    
    // Tell Cargo to re-run the build script if PROXY_URL changes
    println!("cargo:rerun-if-env-changed=PROXY_URL");
    
    // Also trigger rebuild if this build script changes
    println!("cargo:rerun-if-changed=build.rs");
    
    // Run the standard Tauri build process
    tauri_build::build()
}
