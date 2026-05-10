<script>
    import Navbar from "$lib/components/navbar.svelte";
    import * as Card from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import { Progress } from "$lib/components/ui/progress";
    import * as Accordion from "$lib/components/ui/accordion";
    import { 
        Video, 
        FileText, 
        FileAudio, 
        Image as ImageIcon,
        Clock,
        CheckCircle2,
        XCircle,
        Loader2,
        Download,
        ExternalLink,
        ChevronDown,
        ChevronLeft,
        ChevronRight
    } from "@lucide/svelte";
    import { getUserHistory, downloadFileFromServer } from "$lib/api";
    import { onMount } from "svelte";

    let history = $state([]);
    let isLoading = $state(true);
    let error = $state(null);
    
    // Pagination State
    let currentPage = $state(1);
    let totalPages = $state(1);
    let totalJobs = $state(0);
    const limit = 10;

    async function fetchHistory() {
        try {
            isLoading = true;
            const data = await getUserHistory(currentPage, limit);
            // Assuming backend returns { jobs, totalPages, totalCount, currentPage }
            // If backend currently returns a simple array, we'll need to adapt it.
            if (Array.isArray(data)) {
                history = data;
                // If it's a simple array, we can't accurately know total pages without backend update
                // But for now we'll assume we show what we got.
            } else {
                history = data.jobs || [];
                totalPages = data.totalPages || 1;
                totalJobs = data.totalCount || 0;
            }
        } catch (err) {
            error = "Failed to load history. Please try again later.";
            console.error(err);
        } finally {
            isLoading = false;
        }
    }

    function changePage(newPage) {
        if (newPage >= 1 && newPage <= totalPages) {
            currentPage = newPage;
            fetchHistory();
            if (typeof window !== 'undefined') {
                setTimeout(() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }, 50);
            }
        }
    }

    onMount(fetchHistory);

    function getStatusColor(status) {
        switch (status) {
            case 'COMPLETED': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
            case 'FAILED': return 'bg-destructive/10 text-destructive border-destructive/20';
            case 'PROCESSING': return 'bg-blue-500/10 text-blue-600 border-blue-200';
            default: return 'bg-muted text-muted-foreground';
        }
    }

    function getTypeIcon(type) {
        switch (type) {
            case 'VIDEO_RESIZE':
            case 'VIDEO_THUMBNAILS': return Video;
            case 'AUDIO_EXTRACT': return FileAudio;
            case 'OCR_DOCUMENT': return FileText;
            default: return ImageIcon;
        }
    }

    function formatDate(dateString) {
        return new Date(dateString).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async function handleDownload(jobId, url) {
        try {
            await downloadFileFromServer(jobId, url);
        } catch (err) {
            console.error("Download failed:", err);
        }
    }

    function getFileName(url) {
        return url.split('/').pop() || 'Asset';
    }
</script>

<div class="min-h-screen bg-background text-foreground flex flex-col">
    <Navbar currentPath="/history" />
    
    <main class="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full">
        <div class="flex items-center justify-between mb-8">
            <div>
                <h1 class="text-3xl font-bold tracking-tight">Job History</h1>
                <p class="text-muted-foreground mt-1">Review and download your previous processing tasks.</p>
            </div>
            <Button variant="outline" size="sm" onclick={fetchHistory} disabled={isLoading}>
                {#if isLoading}
                    <Loader2 class="w-4 h-4 mr-2 animate-spin" />
                {:else}
                    <Clock class="w-4 h-4 mr-2" />
                {/if}
                Refresh
            </Button>
        </div>

        {#if isLoading && history.length === 0}
            <div class="grid gap-4">
                {#each Array(3) as _}
                    <div class="h-32 w-full bg-muted/50 animate-pulse rounded-xl border"></div>
                {/each}
            </div>
        {:else if error}
            <Card.Root class="border-destructive/20 bg-destructive/5">
                <Card.Content class="pt-6 text-center">
                    <XCircle class="w-10 h-10 text-destructive mx-auto mb-4" />
                    <p class="font-medium text-destructive">{error}</p>
                    <Button variant="outline" class="mt-4" onclick={fetchHistory}>Try Again</Button>
                </Card.Content>
            </Card.Root>
        {:else if history.length === 0}
            <Card.Root class="border-dashed py-12">
                <Card.Content class="text-center">
                    <div class="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock class="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h2 class="text-xl font-semibold">No history yet</h2>
                    <p class="text-muted-foreground mt-2 max-w-xs mx-auto">
                        Your processed files will appear here once you start a new job.
                    </p>
                    <Button class="mt-6" href="/">Start Your First Job</Button>
                </Card.Content>
            </Card.Root>
        {:else}
            <div class="grid gap-4">
                {#each history as job}
                    {@const TypeIcon = getTypeIcon(job.type)}
                    <Card.Root class="overflow-hidden hover:shadow-sm transition-shadow">
                        <Card.Content class="p-0">
                            <div class="flex flex-col">
                                <div class="flex flex-col md:flex-row">
                                    <!-- Status Sidebar -->
                                    <div class="w-1.5 {job.status === 'COMPLETED' ? 'bg-emerald-500' : job.status === 'FAILED' ? 'bg-destructive' : 'bg-primary'}"></div>
                                    
                                    <div class="flex-1 p-5 flex flex-col md:flex-row md:items-center gap-4">
                                        <div class="bg-muted p-3 rounded-xl">
                                            <TypeIcon class="w-6 h-6 text-primary" />
                                        </div>
                                        
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2 mb-1">
                                                <h3 class="font-semibold truncate">{job.originalName}</h3>
                                                <Badge variant="outline" class={getStatusColor(job.status)}>
                                                    {job.status}
                                                </Badge>
                                            </div>
                                            <div class="flex items-center gap-4 text-sm text-muted-foreground">
                                                <span class="flex items-center gap-1">
                                                    <Clock class="w-3 h-3" />
                                                    {formatDate(job.createdAt)}
                                                </span>
                                                <span class="hidden md:inline uppercase text-[10px] font-bold tracking-wider bg-secondary px-1.5 py-0.5 rounded">
                                                    {job.type?.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>

                                        {#if job.status === 'PROCESSING' || job.status === 'PENDING'}
                                            <div class="w-full md:w-48 space-y-2">
                                                <div class="flex justify-between text-xs font-medium">
                                                    <span>Processing...</span>
                                                    <span>{job.progress}%</span>
                                                </div>
                                                <Progress value={job.progress} class="h-1.5" />
                                            </div>
                                        {/if}

                                        <div class="flex items-center gap-2 mt-2 md:mt-0">
                                            {#if job.status === 'COMPLETED' && job.outputUrls?.length === 1}
                                                {@const isDownloaded = job.downloadedIndices?.includes(0)}
                                                <Button 
                                                    size="sm" 
                                                    variant={isDownloaded ? "outline" : "default"}
                                                    class="gap-2 {isDownloaded ? 'text-emerald-600 border-emerald-200 bg-emerald-50/50' : ''}" 
                                                    onclick={() => handleDownload(job._id, job.outputUrls[0])}
                                                >
                                                    {#if isDownloaded}
                                                        <CheckCircle2 class="w-4 h-4" />
                                                        Downloaded
                                                    {:else}
                                                        <Download class="w-4 h-4" />
                                                        Download
                                                    {/if}
                                                </Button>
                                            {:else if job.status === 'FAILED'}
                                                <span class="text-xs text-destructive font-medium max-w-[200px] truncate">
                                                    {job.error || 'Unknown error'}
                                                </span>
                                            {/if}
                                        </div>
                                    </div>
                                </div>

                                {#if job.status === 'COMPLETED' && job.outputUrls?.length > 1}
                                    <div class="border-t bg-muted/30">
                                        <Accordion.Root type="single" class="w-full px-5">
                                            <Accordion.Item value="assets" class="border-none">
                                                <Accordion.Trigger class="py-3 hover:no-underline text-sm font-medium text-muted-foreground">
                                                    View Generated Assets ({job.outputUrls.length})
                                                </Accordion.Trigger>
                                                <Accordion.Content class="pb-4">
                                                    <div class="grid gap-2 mt-1">
                                                        {#each job.outputUrls as url, i}
                                                            {@const isDownloaded = job.downloadedIndices?.includes(i)}
                                                            <div class="flex items-center justify-between p-3 bg-background border rounded-lg group {isDownloaded ? 'border-emerald-100' : ''}">
                                                                <div class="flex items-center gap-3 overflow-hidden">
                                                                    <div class="bg-muted p-1.5 rounded-md">
                                                                        <FileText class="w-4 h-4 {isDownloaded ? 'text-emerald-500' : 'text-primary'}" />
                                                                    </div>
                                                                    <div class="flex flex-col min-w-0">
                                                                        <span class="text-sm font-medium truncate max-w-[250px] md:max-w-md">
                                                                            {getFileName(url)}
                                                                        </span>
                                                                        {#if isDownloaded}
                                                                            <span class="text-[10px] text-emerald-600 font-bold uppercase tracking-tight flex items-center gap-1">
                                                                                <CheckCircle2 class="w-2.5 h-2.5" />
                                                                                Already Downloaded
                                                                            </span>
                                                                        {/if}
                                                                    </div>
                                                                </div>
                                                                <Button 
                                                                    variant={isDownloaded ? "ghost" : "outline"}
                                                                    size="sm" 
                                                                    class="h-8 gap-2 {isDownloaded ? 'text-emerald-600 hover:bg-emerald-50' : 'hover:bg-primary/10'}" 
                                                                    onclick={() => handleDownload(job._id, url)}
                                                                >
                                                                    {#if isDownloaded}
                                                                        <CheckCircle2 class="w-4 h-4" />
                                                                        <span class="hidden sm:inline text-xs">Download Again</span>
                                                                    {:else}
                                                                        <Download class="w-4 h-4" />
                                                                        <span class="hidden sm:inline text-xs">Download</span>
                                                                    {/if}
                                                                </Button>
                                                            </div>
                                                        {/each}
                                                    </div>
                                                </Accordion.Content>
                                            </Accordion.Item>
                                        </Accordion.Root>
                                    </div>
                                {/if}
                            </div>
                        </Card.Content>
                    </Card.Root>
                {/each}
            </div>

            {#if totalPages > 1}
                <div class="mt-8 flex items-center justify-between border-t pt-6">
                    <p class="text-sm text-muted-foreground">
                        Showing <span class="font-medium text-foreground">{(currentPage - 1) * limit + 1}</span> to 
                        <span class="font-medium text-foreground">{Math.min(currentPage * limit, totalJobs)}</span> of 
                        <span class="font-medium text-foreground">{totalJobs}</span> results
                    </p>
                    <div class="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onclick={() => changePage(currentPage - 1)}
                            disabled={currentPage === 1 || isLoading}
                        >
                            <ChevronLeft class="w-4 h-4 mr-1" />
                            Previous
                        </Button>
                        <div class="flex items-center gap-1 mx-2">
                            {#each Array(totalPages) as _, i}
                                {@const pageNum = i + 1}
                                {#if totalPages <= 5 || pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)}
                                    <Button 
                                        variant={currentPage === pageNum ? "default" : "ghost"} 
                                        size="icon" 
                                        class="h-8 w-8 text-xs"
                                        onclick={() => changePage(pageNum)}
                                        disabled={isLoading}
                                    >
                                        {pageNum}
                                    </Button>
                                {:else if (pageNum === 2 && currentPage > 3) || (pageNum === totalPages - 1 && currentPage < totalPages - 2)}
                                    <span class="text-muted-foreground px-1">...</span>
                                {/if}
                            {/each}
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onclick={() => changePage(currentPage + 1)}
                            disabled={currentPage === totalPages || isLoading}
                        >
                            Next
                            <ChevronRight class="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>
            {/if}
        {/if}
    </main>
</div>
