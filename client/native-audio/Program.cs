using System.Diagnostics;
using NAudio.CoreAudioApi;
using NAudio.Wave;

// ScreenBunnyAudioHelper: captura o audio do sistema (48kHz, estereo, float32)
// EXCLUINDO o Discord, e escreve os bytes crus continuamente no stdout.
// Se o Discord nao estiver aberto, cai para captura normal do sistema todo.
//
// Uso: chamado pelo processo principal do Electron via child_process.spawn,
// que le o stdout como um fluxo continuo de PCM.

var format = WaveFormat.CreateIeeeFloatWaveFormat(48000, 2);
var stdout = Console.OpenStandardOutput();

Process? FindDiscordRoot()
{
    var procs = Process.GetProcessesByName("Discord");
    if (procs.Length == 0) return null;
    return procs.FirstOrDefault(p => p.MainWindowHandle != IntPtr.Zero)
           ?? procs.OrderBy(p => p.Id).First();
}

var target = FindDiscordRoot();

WasapiRecorder recorder;
if (target != null)
{
    Console.Error.WriteLine($"Excluindo Discord (PID {target.Id}) da captura de audio.");
    recorder = await new WasapiRecorderBuilder()
        .WithProcessLoopback((uint)target.Id, ProcessLoopbackMode.ExcludeTargetProcessTree)
        .WithFormat(format)
        .BuildAsync();
}
else
{
    Console.Error.WriteLine("Discord nao encontrado - capturando audio do sistema todo.");
    recorder = new WasapiRecorderBuilder()
        .WithLoopbackCapture()
        .WithFormat(format)
        .Build();
}

recorder.DataAvailable += (buffer, flags, _, _) =>
{
    if (buffer.IsEmpty) return;
    try
    {
        stdout.Write(buffer);
        stdout.Flush();
    }
    catch (IOException)
    {
        // pipe fechado pelo processo pai (Electron) - vamos parar no laco principal.
    }
};

recorder.StartRecording();
Console.Error.WriteLine("Captura iniciada.");

// O processo pai (Electron) encerra este helper com kill() quando o
// compartilhamento de tela para - nao ha um sinal "limpo" de parada, entao
// so ficamos vivos indefinidamente ate isso acontecer.
await Task.Delay(Timeout.Infinite);
