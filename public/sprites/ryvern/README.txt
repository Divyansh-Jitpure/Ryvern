Ryvern sprite frame naming:
- idle-1.png
- idle-2.png
- idle-3.png to idle-6.png
- hover-1.png
- hover-2.png
- working-1.png onward

The app will automatically switch from placeholder vector graphics to sprite rendering
when all required files are present.

Regenerate the working frames from the source sheet with:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/extract-working-sprites.ps1
