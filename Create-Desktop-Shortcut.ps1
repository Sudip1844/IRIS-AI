$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\MJ-AI.lnk")

$Shortcut.TargetPath = "D:\Antigravity\New folder\MJ-AI\Start-MJ.vbs"
$Shortcut.WorkingDirectory = "D:\Antigravity\New folder\MJ-AI"
$Shortcut.WindowStyle = 7
$Shortcut.IconLocation = "D:\Antigravity\New folder\MJ-AI\build\icon.ico"
$Shortcut.Description = "Launch MJ-AI Assistant"
$Shortcut.Save()

Write-Host "Shortcut created successfully at $DesktopPath\MJ-AI.lnk"
