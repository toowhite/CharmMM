set INTERVAL=10
schtasks /create /sc MINUTE /mo %INTERVAL% /tn CharmMM /tr "wscript %cd%\run_silently.vbs"
cscript CreateShortcut.vbs