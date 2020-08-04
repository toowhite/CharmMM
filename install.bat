set INTERVAL=10
schtasks /create /sc MINUTE /mo %INTERVAL% /tn CharmMM /tr "wscript %cd%\run_silently.vbs"

@echo off
echo Set oWS = WScript.CreateObject("WScript.Shell") > CreateShortcut.vbs
echo sLinkFile = "%HOMEDRIVE%%HOMEPATH%\Desktop\Change background.lnk" >> CreateShortcut.vbs
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> CreateShortcut.vbs
echo oLink.TargetPath = "%cd%\run_silently.vbs" >> CreateShortcut.vbs
echo oLink.HotKey = "ALT+CTRL+B" >> CreateShortcut.vbs
echo oLink.IconLocation = "%cd%\icon.ico" >> CreateShortcut.vbs
echo oLink.Save >> CreateShortcut.vbs
cscript CreateShortcut.vbs
del CreateShortcut.vbs