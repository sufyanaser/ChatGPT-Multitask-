Add-Type -AssemblyName System.Drawing

$srcPath = "G:\PROJECTS\3- ChatGPT-Multitask\Glossy Blue-Purple ChatGPT Icon.png"
$assetsDir = "G:\PROJECTS\3- ChatGPT-Multitask\assets"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

function Resize-ToSquare([System.Drawing.Bitmap]$source, [int]$size) {
    $canvas = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $g.Clear([System.Drawing.Color]::Transparent)

    $scale = [Math]::Min($size / $source.Width, $size / $source.Height)
    $newW = [int][Math]::Round($source.Width * $scale)
    $newH = [int][Math]::Round($source.Height * $scale)
    $x = [int][Math]::Round(($size - $newW) / 2)
    $y = [int][Math]::Round(($size - $newH) / 2)

    $g.DrawImage($source, $x, $y, $newW, $newH)
    $g.Dispose()
    return $canvas
}

# 1. Master PNG 1024x1024
$master1024 = Resize-ToSquare $src 1024
$master1024.Save((Join-Path $assetsDir "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$master1024.Save((Join-Path $assetsDir "icon-1024.png"), [System.Drawing.Imaging.ImageFormat]::Png)

$sizes = @(16, 24, 32, 48, 64, 128, 256, 512)
$pngBytesMap = @{}

foreach ($s in $sizes) {
    $bmp = Resize-ToSquare $src $s
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $pngBytesMap[$s] = $bytes
    $bmp.Save((Join-Path $assetsDir "icon-$s.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $ms.Dispose()
    $bmp.Dispose()
}

$ms1024 = New-Object System.IO.MemoryStream
$master1024.Save($ms1024, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytesMap[1024] = $ms1024.ToArray()
$ms1024.Dispose()
$master1024.Dispose()
$src.Dispose()

# 2. Build Windows .ico (16, 24, 32, 48, 64, 128, 256)
$icoSizes = @(16, 24, 32, 48, 64, 128, 256)
$icoFs = [System.IO.File]::Create((Join-Path $assetsDir "icon.ico"))
$icoBw = New-Object System.IO.BinaryWriter($icoFs)

$icoBw.Write([uint16]0) # Reserved
$icoBw.Write([uint16]1) # Type 1 = Icon
$icoBw.Write([uint16]$icoSizes.Count) # Image count

$offset = 6 + ($icoSizes.Count * 16)
foreach ($s in $icoSizes) {
    $bytes = $pngBytesMap[$s]
    $wByte = if ($s -ge 256) { [byte]0 } else { [byte]$s }
    $hByte = if ($s -ge 256) { [byte]0 } else { [byte]$s }
    $icoBw.Write($wByte)
    $icoBw.Write($hByte)
    $icoBw.Write([byte]0) # Color palette count
    $icoBw.Write([byte]0) # Reserved
    $icoBw.Write([uint16]1) # Color planes
    $icoBw.Write([uint16]32) # Bits per pixel
    $icoBw.Write([uint32]$bytes.Length) # Image data size
    $icoBw.Write([uint32]$offset) # Offset
    $offset += $bytes.Length
}

foreach ($s in $icoSizes) {
    $icoBw.Write($pngBytesMap[$s])
}
$icoBw.Flush()
$icoFs.Close()
Write-Host "Windows icon.ico created successfully."

# 3. Build macOS .icns (16, 32, 64, 128, 256, 512, 1024)
# OSTypes:
# 'ic04' = 16x16, 'ic05' = 32x32, 'ic07' = 128x128, 'ic08' = 256x256, 'ic09' = 512x512, 'ic10' = 1024x1024 (10.7+)
# 'ic11' = 16x16@2x (32x32), 'ic12' = 32x32@2x (64x64), 'ic13' = 128x128@2x (256x256), 'ic14' = 256x256@2x (512x512)
$icnsEntries = @(
    @{ Tag = "ic04"; Size = 16 },
    @{ Tag = "ic05"; Size = 32 },
    @{ Tag = "ic07"; Size = 128 },
    @{ Tag = "ic08"; Size = 256 },
    @{ Tag = "ic09"; Size = 512 },
    @{ Tag = "ic10"; Size = 1024 },
    @{ Tag = "ic11"; Size = 32 },
    @{ Tag = "ic12"; Size = 64 },
    @{ Tag = "ic13"; Size = 256 },
    @{ Tag = "ic14"; Size = 512 }
)

$icnsFs = [System.IO.File]::Create((Join-Path $assetsDir "icon.icns"))
$icnsBw = New-Object System.IO.BinaryWriter($icnsFs)

# Pre-calculate total length
$totalLength = 8 # 'icns' (4) + length (4)
foreach ($e in $icnsEntries) {
    $totalLength += 8 + $pngBytesMap[$e.Size].Length
}

# Write header (big-endian)
$magic = [System.Text.Encoding]::ASCII.GetBytes("icns")
$icnsBw.Write($magic)
$lenBytes = [System.BitConverter]::GetBytes([uint32]$totalLength)
if ([System.BitConverter]::IsLittleEndian) { [Array]::Reverse($lenBytes) }
$icnsBw.Write($lenBytes)

# Write each entry
foreach ($e in $icnsEntries) {
    $tagBytes = [System.Text.Encoding]::ASCII.GetBytes($e.Tag)
    $icnsBw.Write($tagBytes)
    $entryLen = 8 + $pngBytesMap[$e.Size].Length
    $entryLenBytes = [System.BitConverter]::GetBytes([uint32]$entryLen)
    if ([System.BitConverter]::IsLittleEndian) { [Array]::Reverse($entryLenBytes) }
    $icnsBw.Write($entryLenBytes)
    $icnsBw.Write($pngBytesMap[$e.Size])
}

$icnsBw.Flush()
$icnsFs.Close()
Write-Host "macOS icon.icns created successfully with length: $totalLength bytes."
