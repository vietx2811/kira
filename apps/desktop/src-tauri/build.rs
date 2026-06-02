fn main() {
    build_apple_helper(
        "apple_helpers/vixio_vision_ocr.swift",
        "vixio-vision-ocr-helper",
    );
    build_apple_helper(
        "apple_helpers/vixio_foundation_models.swift",
        "vixio-foundation-models-helper",
    );
    build_apple_helper(
        "apple_helpers/vixio_natural_language.swift",
        "vixio-natural-language-helper",
    );
    tauri_build::build()
}

fn build_apple_helper(source_relative_path: &str, binary_name: &str) {
    #[cfg(not(target_os = "macos"))]
    {
        let env_name = helper_env_name(binary_name);
        println!("cargo:rustc-env={env_name}=");
    }

    #[cfg(target_os = "macos")]
    {
        use std::{env, path::PathBuf, process::Command};

        let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("manifest dir"));
        let target = env::var("TARGET").expect("target triple");
        let source = manifest_dir.join(source_relative_path);
        let out_dir = PathBuf::from(env::var("OUT_DIR").expect("out dir"));
        let helper_path = out_dir.join(binary_name);
        let sidecar_dir = manifest_dir.join("binaries");
        let sidecar_path = sidecar_dir.join(format!("{binary_name}-{target}"));
        let env_name = helper_env_name(binary_name);

        println!("cargo:rerun-if-changed={}", source.display());

        let status = Command::new("/usr/bin/swiftc")
            .arg(&source)
            .arg("-o")
            .arg(&helper_path)
            .status();

        match status {
            Ok(status) if status.success() => {
                println!("cargo:rustc-env={env_name}={}", helper_path.display());
                if let Err(error) = std::fs::create_dir_all(&sidecar_dir)
                    .and_then(|_| std::fs::copy(&helper_path, &sidecar_path).map(|_| ()))
                {
                    println!("cargo:warning=Unable to stage {binary_name} sidecar: {error}");
                }
            }
            Ok(status) => {
                println!(
                    "cargo:warning=Unable to build {binary_name}: swiftc exited with {status}"
                );
                stage_fallback_helper(binary_name, &helper_path, &sidecar_dir, &sidecar_path);
                println!("cargo:rustc-env={env_name}={}", helper_path.display());
            }
            Err(error) => {
                println!("cargo:warning=Unable to build {binary_name}: {error}");
                stage_fallback_helper(binary_name, &helper_path, &sidecar_dir, &sidecar_path);
                println!("cargo:rustc-env={env_name}={}", helper_path.display());
            }
        }
    }
}

fn helper_env_name(binary_name: &str) -> String {
    format!(
        "VIXIO_{}_HELPER",
        binary_name
            .trim_start_matches("vixio-")
            .replace('-', "_")
            .to_uppercase()
    )
}

#[cfg(target_os = "macos")]
fn stage_fallback_helper(
    binary_name: &str,
    helper_path: &std::path::Path,
    sidecar_dir: &std::path::Path,
    sidecar_path: &std::path::Path,
) {
    use std::os::unix::fs::PermissionsExt;

    let source = if binary_name == "vixio-foundation-models-helper" {
        "#!/bin/sh\nif [ \"$1\" = \"availability\" ]; then echo 'unavailable\\tsdk-unavailable'; exit 0; fi\necho 'unavailable: sdk-unavailable' >&2\nexit 3\n"
    } else {
        "#!/bin/sh\necho 'helper unavailable' >&2\nexit 3\n"
    };

    if let Err(error) = std::fs::write(helper_path, source)
        .and_then(|_| std::fs::set_permissions(helper_path, std::fs::Permissions::from_mode(0o755)))
        .and_then(|_| std::fs::create_dir_all(sidecar_dir))
        .and_then(|_| std::fs::copy(helper_path, sidecar_path).map(|_| ()))
    {
        println!("cargo:warning=Unable to stage fallback {binary_name}: {error}");
    }
}
