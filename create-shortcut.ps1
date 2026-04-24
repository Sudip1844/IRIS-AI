$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "MJ Assistant.lnk"

# Delete old shortcut if exists
if (Test-Path $shortcutPath) { Remove-Item $shortcutPath -Force }

$s = $ws.CreateShortcut($shortcutPath)
$s.TargetPath = Join-Path $env:windir "system32\wscript.exe"
$s.Arguments = '"D:\Antigravity\New folder\IRIS-AI\start-mj.vbs"'
$s.WorkingDirectory = 'D:\Antigravity\New folder\IRIS-AI'

# Use icon if it exists, otherwise use default
$iconPath = 'D:\Antigravity\New folder\IRIS-AI\build\icon.ico'
if (Test-Path $iconPath) {
    $s.IconLocation = "$iconPath,0"
}

$s.Description = 'MJ Assistant - AI Desktop Agent'
$s.Save()
Write-Host "Shortcut created at: $shortcutPath"
Write-Host "Double-click 'MJ Assistant' on your Desktop to launch!"
