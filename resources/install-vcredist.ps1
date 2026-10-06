# Instala o Visual C++ Redistributable (x64) da Microsoft se ainda não estiver instalado.
# O módulo do Spout (Resolume) depende dele; sem ele o Windows não consegue carregá-lo.
$ErrorActionPreference = 'Stop'
$key = 'HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64'
$installed = $false
try { $installed = ((Get-ItemProperty -Path $key -Name Installed).Installed -eq 1) } catch { $installed = $false }
if ($installed) { exit 0 }

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $file = Join-Path $env:TEMP 'telalink_vc_redist.x64.exe'
  Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vc_redist.x64.exe' -OutFile $file -UseBasicParsing
  Start-Process -FilePath $file -ArgumentList '/install', '/quiet', '/norestart' -Wait
  Remove-Item $file -ErrorAction SilentlyContinue
} catch {
  exit 1
}
