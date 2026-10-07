use std::{
    fs::{self, OpenOptions},
    io::{ErrorKind, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

pub fn directory() -> Result<PathBuf, String> {
    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    Ok(executable
        .parent()
        .ok_or("Could not locate the game folder")?
        .join("Screenshots"))
}

pub fn save(png: &[u8]) -> Result<String, String> {
    let directory = directory()?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    save_in(&directory, png, timestamp).map(|path| path.to_string_lossy().into_owned())
}

fn save_in(directory: &Path, png: &[u8], timestamp: u128) -> Result<PathBuf, String> {
    // The caller supplies image bytes only; the app chooses both directory and filename.
    if !png.starts_with(b"\x89PNG\r\n\x1a\n") || png.len() > 64 * 1024 * 1024 {
        return Err("Invalid screenshot image".into());
    }
    fs::create_dir_all(directory)
        .map_err(|error| format!("Could not create Screenshots: {error}"))?;
    for suffix in 0..1000 {
        let path = directory.join(format!("Glyphport-{timestamp}-{suffix}.png"));
        let mut file = match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => file,
            Err(error) if error.kind() == ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(format!("Could not save screenshot: {error}")),
        };
        if let Err(error) = file.write_all(png) {
            drop(file);
            let _ = fs::remove_file(&path);
            return Err(format!("Could not write screenshot: {error}"));
        }
        return Ok(path);
    }
    Err("Could not choose an unused screenshot filename".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_folder_and_never_overwrites_screenshots() {
        let directory = std::env::temp_dir().join(format!(
            "glyphport-screenshots-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let png = b"\x89PNG\r\n\x1a\nscreenshot bytes";
        let first = save_in(&directory, png, 123).unwrap();
        let second = save_in(&directory, png, 123).unwrap();
        assert_ne!(first, second);
        assert_eq!(fs::read(first).unwrap(), png);
        assert_eq!(fs::read(second).unwrap(), png);
        assert!(save_in(&directory, b"not a PNG", 123).is_err());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn reports_folder_errors_without_opening_a_dialog() {
        let directory = std::env::current_exe().unwrap().join("Screenshots");
        assert!(save_in(&directory, b"\x89PNG\r\n\x1a\n", 123).is_err());
    }
}
