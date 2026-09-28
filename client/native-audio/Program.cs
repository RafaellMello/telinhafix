using System.Diagnostics;
using NAudio.CoreAudioApi;
using NAudio.Wave;

// TelinhaFixAudioHelper: captura o audio do sistema (48kHz, estereo, float32)
// e escreve os bytes crus continuamente no stdout.
//
// Argumentos: <modo> [nome-do-processo]
//   system                 -> audio do sistema todo, sem filtro
//   exclude <processo>     -> tudo, exceto o audio desse processo (ex: Discord)
//   include <processo>     -> somente o audio desse processo (ex: um jogo)
// Sem argumentos, o padrao e "exclude Discord" (comportamento original).
// Se o processo alvo nao for encontrado, cai para audio do sistema todo.
//
// Uso: chamado pelo processo principal do Electron via child_process.spawn,
// que le o stdout como um fluxo continuo de PCM.

var format = WaveFormat.CreateIeeeFloatWaveFormat(48000, 2);
var stdout = Console.OpenStandardOutput();

var mode = args.Length > 0 ? args[0] : "exclude";
var targetName = args.Length > 1 ? args[1] : "Discord";

Process? FindProcessRoot(string processName)
{
    var procs = Process.GetProcessesByName(processName);
    if (procs.Length == 0) return null;
    return procs.FirstOrDefault(p => p.MainWindowHandle != IntPtr.Zero)
           ?? procs.OrderBy(p => p.Id).First();
}

WasapiRecorder recorder;

if (mode == "system")
{
    Console.Error.WriteLine("Capturando audio do sistema todo (sem filtro).");
    recorder = new WasapiRecorderBuilder()
        .WithLoopbackCapture()
        .WithFormat(format)
        .Build();
}
else
{
    var target = FindProcessRoot(targetName);
    if (target == null)
    {
        Console.Error.WriteLine($"Processo '{targetName}' nao encontrado - capturando audio do sistema todo.");
        recorder = new WasapiRecorderBuilder()
            .WithLoopbackCapture()
            .WithFormat(format)
            .Build();
    }
    else if (mode == "include")
    {
        Console.Error.WriteLine($"Capturando SOMENTE o audio de '{targetName}' (PID {target.Id}).");
        recorder = await new WasapiRecorderBuilder()
            .WithProcessLoopback((uint)target.Id, ProcessLoopbackMode.IncludeTargetProcessTree)
            .WithFormat(format)
            .BuildAsync();
    }
    else
    {
        Console.Error.WriteLine($"Excluindo '{targetName}' (PID {target.Id}) da captura de audio.");
        recorder = await new WasapiRecorderBuilder()
            .WithProcessLoopback((uint)target.Id, ProcessLoopbackMode.ExcludeTargetProcessTree)
            .WithFormat(format)
            .BuildAsync();
    }
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
