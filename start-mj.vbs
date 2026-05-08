Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\Antigravity\New folder\MJ-AI"
WshShell.Run """D:\Antigravity\New folder\MJ-AI\Start-MJ.bat""", 0, False
Set WshShell = Nothing
