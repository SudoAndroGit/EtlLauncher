#[tauri::command]
pub async fn read_windows_wallpaper(
    window: tauri::WebviewWindow,
) -> Result<tauri::ipc::Response, &'static str> {
    if window.label() != "main" {
        return Err("El fondo de Windows solo está disponible en la ventana principal.");
    }
    let bytes = tauri::async_runtime::spawn_blocking(read_wallpaper)
        .await
        .map_err(|_| "No se pudo leer el fondo de Windows.")??;
    Ok(tauri::ipc::Response::new(bytes))
}

#[cfg(target_os = "windows")]
fn read_wallpaper() -> Result<Vec<u8>, &'static str> {
    use std::ffi::OsString;
    use std::fs::File;
    use std::io::Read;
    use std::os::windows::ffi::OsStringExt;
    use std::path::{Component, PathBuf, Prefix};
    use windows::Win32::UI::WindowsAndMessaging::{
        SPI_GETDESKWALLPAPER, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS, SystemParametersInfoW,
    };

    const MAX_BYTES: u64 = 22 * 1024 * 1024;
    const READ_ERROR: &str = "No se pudo leer la imagen actual de Windows.";
    let mut buffer = [0u16; 260];
    // Windows writes a null-terminated path within the supplied UTF-16 buffer.
    unsafe {
        SystemParametersInfoW(
            SPI_GETDESKWALLPAPER,
            buffer.len() as u32,
            Some(buffer.as_mut_ptr().cast()),
            SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
        )
    }
    .map_err(|_| READ_ERROR)?;
    let length = buffer.iter().position(|&unit| unit == 0).ok_or(READ_ERROR)?;
    if length == 0 {
        return Err("Windows no tiene una imagen de escritorio activa.");
    }

    let path = PathBuf::from(OsString::from_wide(&buffer[..length]));
    let path = path.canonicalize().map_err(|_| READ_ERROR)?;
    let Some(Component::Prefix(prefix)) = path.components().next() else {
        return Err(READ_ERROR);
    };
    if !matches!(prefix.kind(), Prefix::Disk(_) | Prefix::VerbatimDisk(_)) {
        return Err("El fondo de Windows debe estar en un disco local.");
    }
    if !path.is_file() {
        return Err(READ_ERROR);
    }
    let file = File::open(path).map_err(|_| READ_ERROR)?;
    let metadata = file.metadata().map_err(|_| READ_ERROR)?;
    if !metadata.is_file() || metadata.len() > MAX_BYTES {
        return Err("El fondo de Windows supera el límite de 22 MiB o no es una imagen.");
    }
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    file.take(MAX_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| READ_ERROR)?;
    if bytes.len() as u64 > MAX_BYTES {
        return Err("El fondo de Windows supera el límite de 22 MiB.");
    }
    if !(bytes.starts_with(b"\xFF\xD8\xFF")
        || bytes.starts_with(b"\x89PNG\r\n\x1A\n")
        || (bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP"))
        || bytes.starts_with(b"GIF87a")
        || bytes.starts_with(b"GIF89a"))
    {
        return Err("Windows debe tener un fondo JPG, PNG, WebP o GIF para usar esta opción.");
    }
    Ok(bytes)
}

#[cfg(not(target_os = "windows"))]
fn read_wallpaper() -> Result<Vec<u8>, &'static str> {
    Err("Esta opción de fondo está disponible en Windows.")
}
