using System.Diagnostics;
using System.Runtime.InteropServices;
using NAudio.CoreAudioApi;
using NAudio.CoreAudioApi.Interfaces;
using NAudio.Wave;

// TelinhaFixAudioHelper: captura o audio do sistema (48kHz, estereo, float32)
// e escreve os bytes crus continuamente no stdout.
//
// Argumentos: <modo> [nome-do-processo] [--self-pid <pid>]
//   system                 -> audio do sistema todo
//   exclude <processo>     -> tudo, exceto o audio desse processo (ex: Discord)
//   include <processo>     -> somente o audio desse processo (ex: um jogo)
//   --self-pid <pid>       -> PID do TelinhaFix: nos modos system/exclude o
//                             audio do proprio TelinhaFix (o som de quem voce
//                             esta ouvindo na sala) tambem fica de fora.
// Sem argumentos, o padrao e "exclude Discord" (comportamento original).
//
// Por que existe o modo "varios programas": a captura por processo do
// Windows (process loopback) so consegue EXCLUIR UM processo. Excluindo so o
// Discord, o som que o TelinhaFix toca (a transmissao do seu amigo) vazava
// pra sua transmissao e voltava pra ele em eco - por isso o app mutava todo
// mundo enquanto voce compartilhava. Agora, com --self-pid, capturamos CADA
// programa que tem sessao de audio (menos o Discord e o TelinhaFix), um por
// um, e misturamos tudo aqui. Quando isso funciona, escrevemos "ECHO_SAFE"
// no stderr pro app saber que pode deixar o audio dos outros ligado.
//
// Uso: chamado pelo processo principal do Electron via child_process.spawn,
// que le o stdout como um fluxo continuo de PCM.

var format = WaveFormat.CreateIeeeFloatWaveFormat(48000, 2);
var output = new PcmOutput(Console.OpenStandardOutput());

uint selfPid = 0;
var positional = new List<string>();
for (int i = 0; i < args.Length; i++)
{
    if (args[i] == "--self-pid" && i + 1 < args.Length)
    {
        uint.TryParse(args[++i], out selfPid);
        continue;
    }
    positional.Add(args[i]);
}
var mode = positional.Count > 0 ? positional[0] : "exclude";
var targetName = positional.Count > 1 ? positional[1] : "Discord";

// Process loopback precisa do Windows 10 build 20348+ (Windows 11).
bool multiSupported = Environment.OSVersion.Version.Build >= 20348;

if (mode != "include" && selfPid != 0 && multiSupported)
{
    try
    {
        var excludedNames = mode == "exclude" ? new[] { targetName } : Array.Empty<string>();
        var multi = new MultiProcessCapture(format, output, selfPid, excludedNames);
        await multi.RunAsync();
        return;
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Captura por programa falhou ({ex.Message}) - voltando pra captura simples.");
    }
}

// --- Captura simples (um recorder so) - modo include ou fallback ------------

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
    if ((flags & AudioClientBufferFlags.Silent) != 0) output.WriteSilence(buffer.Length);
    else output.Write(buffer);
};

recorder.StartRecording();
Console.Error.WriteLine("Captura iniciada.");

// O processo pai (Electron) encerra este helper com kill() quando o
// compartilhamento de tela para - nao ha um sinal "limpo" de parada, entao
// so ficamos vivos indefinidamente ate isso acontecer.
await Task.Delay(Timeout.Infinite);

// ---------------------------------------------------------------------------

sealed class PcmOutput
{
    readonly Stream stream;
    readonly object gate = new();
    byte[] zeros = new byte[0];
    public PcmOutput(Stream stream) { this.stream = stream; }

    public void Write(ReadOnlySpan<byte> data)
    {
        lock (gate)
        {
            try { stream.Write(data); stream.Flush(); }
            catch (IOException) { /* pipe fechado pelo Electron - ele vai matar a gente */ }
        }
    }

    public void WriteSilence(int length)
    {
        if (zeros.Length < length) zeros = new byte[length];
        Write(zeros.AsSpan(0, length));
    }
}

// Fila de audio de UM programa capturado. O audio de cada programa chega no
// ritmo dele (pacotes de ~10ms); o misturador tira daqui no ritmo do relogio.
// So comeca a tocar depois de juntar PRIME_FRAMES (folga contra engasgo), e
// se acumular demais (relogios diferentes, travada) descarta o excesso.
sealed class SourceQueue
{
    const int CAPACITY_FRAMES = 48000;      // 1s
    const int PRIME_FRAMES = 1440;          // 30ms
    const int MAX_BUFFERED_FRAMES = 9600;   // 200ms
    readonly float[] buf = new float[CAPACITY_FRAMES * 2];
    int readFrame, countFrames;
    bool primed;
    readonly object gate = new();

    public void Push(ReadOnlySpan<byte> bytes, bool silent)
    {
        int frames = bytes.Length / 8;
        var samples = MemoryMarshal.Cast<byte, float>(bytes[..(frames * 8)]);
        lock (gate)
        {
            for (int f = 0; f < frames; f++)
            {
                if (countFrames == CAPACITY_FRAMES) { readFrame = (readFrame + 1) % CAPACITY_FRAMES; countFrames--; }
                int w = ((readFrame + countFrames) % CAPACITY_FRAMES) * 2;
                buf[w] = silent ? 0 : samples[f * 2];
                buf[w + 1] = silent ? 0 : samples[f * 2 + 1];
                countFrames++;
            }
            if (countFrames > MAX_BUFFERED_FRAMES)
            {
                int drop = countFrames - PRIME_FRAMES;
                readFrame = (readFrame + drop) % CAPACITY_FRAMES;
                countFrames -= drop;
            }
        }
    }

    // Soma ate "frames" frames desta fila em mix. Devolve se contribuiu.
    public bool MixInto(float[] mix, int frames)
    {
        lock (gate)
        {
            if (!primed)
            {
                if (countFrames < PRIME_FRAMES) return false;
                primed = true;
            }
            int n = Math.Min(frames, countFrames);
            for (int f = 0; f < n; f++)
            {
                int r = ((readFrame + f) % CAPACITY_FRAMES) * 2;
                mix[f * 2] += buf[r];
                mix[f * 2 + 1] += buf[r + 1];
            }
            readFrame = (readFrame + n) % CAPACITY_FRAMES;
            countFrames -= n;
            if (n < frames) primed = false; // esvaziou: espera juntar folga de novo
            return n > 0;
        }
    }
}

sealed class MultiProcessCapture
{
    readonly WaveFormat format;
    readonly PcmOutput output;
    readonly uint selfPid;
    readonly string[] excludedNames;
    readonly Dictionary<uint, (WasapiRecorder rec, SourceQueue queue, string name)> sources = new();
    readonly Dictionary<uint, DateTime> retryAfter = new();
    readonly HashSet<uint> loggedSkips = new();

    public MultiProcessCapture(WaveFormat format, PcmOutput output, uint selfPid, string[] excludedNames)
    {
        this.format = format;
        this.output = output;
        this.selfPid = selfPid;
        this.excludedNames = excludedNames;
    }

    public async Task RunAsync()
    {
        // Testa se da pra ativar captura por processo antes de prometer ECHO_SAFE.
        var probe = await new WasapiRecorderBuilder()
            .WithProcessLoopback(selfPid, ProcessLoopbackMode.IncludeTargetProcessTree)
            .WithFormat(format)
            .BuildAsync();
        probe.Dispose();

        await RefreshAsync();
        Console.Error.WriteLine($"Captura por programa iniciada (sem {string.Join(", ", excludedNames.Append("TelinhaFix"))}).");
        Console.Error.WriteLine("ECHO_SAFE");

        var mixer = new Thread(MixLoop) { IsBackground = true, Priority = ThreadPriority.AboveNormal, Name = "mixer" };
        mixer.Start();

        while (true)
        {
            await Task.Delay(1000);
            try { await RefreshAsync(); }
            catch (Exception ex) { Console.Error.WriteLine($"Falha ao atualizar a lista de programas: {ex.Message}"); }
        }
    }

    void MixLoop()
    {
        Native.timeBeginPeriod(1);
        var mix = new float[9600 * 2];
        var sw = Stopwatch.StartNew();
        long produced = 0;
        while (true)
        {
            long target = sw.ElapsedTicks * 48000 / Stopwatch.Frequency;
            if (target - produced > 9600) produced = target - 4800; // travou: nao tenta recuperar tudo
            int frames = (int)Math.Min(target - produced, 4800);
            if (frames > 0)
            {
                Array.Clear(mix, 0, frames * 2);
                bool any = false;
                SourceQueue[] queues;
                lock (sources) queues = sources.Values.Select(s => s.queue).ToArray();
                foreach (var q in queues) any |= q.MixInto(mix, frames);
                produced += frames;
                if (any)
                {
                    for (int i = 0; i < frames * 2; i++) mix[i] = Math.Clamp(mix[i], -1f, 1f);
                    output.Write(MemoryMarshal.AsBytes(mix.AsSpan(0, frames * 2)));
                }
            }
            Thread.Sleep(5);
        }
    }

    async Task RefreshAsync()
    {
        var procs = Native.SnapshotProcesses(); // pid -> (parent, exe)

        var excludedRoots = new HashSet<uint> { selfPid };
        foreach (var name in excludedNames)
            foreach (var p in Process.GetProcessesByName(name)) excludedRoots.Add((uint)p.Id);

        IEnumerable<uint> AncestorsAndSelf(uint pid)
        {
            var seen = new HashSet<uint>();
            while (pid != 0 && seen.Add(pid) && seen.Count < 64)
            {
                yield return pid;
                if (!procs.TryGetValue(pid, out var info)) yield break;
                pid = info.parent;
            }
        }
        bool InExcludedTree(uint pid) => AncestorsAndSelf(pid).Any(excludedRoots.Contains);
        // Incluir a "arvore" de pid levaria junto um processo excluido?
        bool ContainsExcluded(uint pid) => excludedRoots.Any(root => AncestorsAndSelf(root).Contains(pid));

        // Programas com sessao de audio em qualquer saida de som ativa.
        var sessionPids = new HashSet<uint>();
        using (var enumerator = new MMDeviceEnumerator())
        {
            foreach (var device in enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active))
            {
                using (device)
                {
                    var manager = device.AudioSessionManager;
                    manager.RefreshSessions();
                    var sessions = manager.Sessions;
                    for (int i = 0; i < sessions.Count; i++)
                    {
                        using var session = sessions[i];
                        if (session.IsSystemSoundsSession) continue;
                        if (session.State == AudioSessionState.AudioSessionStateExpired) continue;
                        uint pid = session.GetProcessID;
                        if (pid != 0) sessionPids.Add(pid);
                    }
                }
            }
        }

        // Remove capturas de programas que fecharam ou que passaram a conter
        // um processo excluido (ex: abriram o Discord a partir dele).
        foreach (var pid in sources.Keys.ToArray())
        {
            if (!procs.ContainsKey(pid) || InExcludedTree(pid) || ContainsExcluded(pid)) RemoveSource(pid);
        }

        foreach (var pid in sessionPids)
        {
            if (sources.ContainsKey(pid)) continue;
            if (InExcludedTree(pid)) continue;
            if (AncestorsAndSelf(pid).Any(sources.ContainsKey)) continue; // ja vem junto com o "pai"
            if (ContainsExcluded(pid))
            {
                if (loggedSkips.Add(pid))
                    Console.Error.WriteLine($"Pulando {Name(procs, pid)} (PID {pid}): capturar ele levaria junto o Discord/TelinhaFix.");
                continue;
            }
            if (retryAfter.TryGetValue(pid, out var when) && DateTime.UtcNow < when) continue;

            // O "pai" chegou depois dos filhos: ele cobre os filhos, tira eles.
            foreach (var child in sources.Keys.ToArray())
                if (AncestorsAndSelf(child).Skip(1).Contains(pid)) RemoveSource(child);

            try
            {
                var queue = new SourceQueue();
                var rec = await new WasapiRecorderBuilder()
                    .WithProcessLoopback(pid, ProcessLoopbackMode.IncludeTargetProcessTree)
                    .WithFormat(format)
                    .BuildAsync();
                rec.DataAvailable += (buffer, flags, _, _) =>
                {
                    if (!buffer.IsEmpty) queue.Push(buffer, (flags & AudioClientBufferFlags.Silent) != 0);
                };
                rec.StartRecording();
                lock (sources) sources[pid] = (rec, queue, Name(procs, pid));
                Console.Error.WriteLine($"Capturando {Name(procs, pid)} (PID {pid}).");
            }
            catch (Exception ex)
            {
                retryAfter[pid] = DateTime.UtcNow.AddSeconds(10);
                Console.Error.WriteLine($"Nao deu pra capturar {Name(procs, pid)} (PID {pid}): {ex.Message}");
            }
        }
    }

    void RemoveSource(uint pid)
    {
        (WasapiRecorder rec, SourceQueue queue, string name) entry;
        lock (sources)
        {
            if (!sources.Remove(pid, out entry)) return;
        }
        try { entry.rec.StopRecording(); } catch { }
        try { entry.rec.Dispose(); } catch { }
        Console.Error.WriteLine($"Parou de capturar {entry.name} (PID {pid}).");
    }

    static string Name(Dictionary<uint, (uint parent, string exe)> procs, uint pid) =>
        procs.TryGetValue(pid, out var info) ? info.exe : "?";
}

static class Native
{
    [DllImport("winmm.dll")] public static extern uint timeBeginPeriod(uint ms);

    const uint TH32CS_SNAPPROCESS = 0x2;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct PROCESSENTRY32W
    {
        public uint dwSize;
        public uint cntUsage;
        public uint th32ProcessID;
        public IntPtr th32DefaultHeapID;
        public uint th32ModuleID;
        public uint cntThreads;
        public uint th32ParentProcessID;
        public int pcPriClassBase;
        public uint dwFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szExeFile;
    }

    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint pid);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32FirstW(IntPtr snapshot, ref PROCESSENTRY32W entry);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32NextW(IntPtr snapshot, ref PROCESSENTRY32W entry);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);

    // pid -> (pid do pai, nome do exe) de todos os processos agora.
    public static Dictionary<uint, (uint parent, string exe)> SnapshotProcesses()
    {
        var result = new Dictionary<uint, (uint, string)>();
        var snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if (snap == IntPtr.Zero || snap == new IntPtr(-1)) return result;
        try
        {
            var entry = new PROCESSENTRY32W { dwSize = (uint)Marshal.SizeOf<PROCESSENTRY32W>() };
            if (!Process32FirstW(snap, ref entry)) return result;
            do { result[entry.th32ProcessID] = (entry.th32ParentProcessID, entry.szExeFile); }
            while (Process32NextW(snap, ref entry));
        }
        finally { CloseHandle(snap); }
        return result;
    }
}
