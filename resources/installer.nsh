!macro customInstall
  SetRegView 64
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  ${If} $0 != 1
    ; Em segundo plano, sem esperar: a instalação do TelaLink termina na hora e o
    ; componente da Microsoft é baixado/instalado em paralelo.
    Exec 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "$INSTDIR\resources\resources\install-vcredist.ps1"'
  ${EndIf}
!macroend
