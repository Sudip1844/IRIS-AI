Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\Antigravity\New folder\IRIS-AI"
WshShell.Run """D:\Antigravity\New folder\IRIS-AI\start-mj.bat""", 0, False
Set WshShell = Nothing
