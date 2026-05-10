<script>
    import * as Tabs from "$lib/components/ui/tabs";
    import * as Card from "$lib/components/ui/card";
    import * as Select from "$lib/components/ui/select";
    import { Button } from "$lib/components/ui/button";
    import { Label } from "$lib/components/ui/label";
    import { Badge } from "$lib/components/ui/badge";
    import { Progress } from "$lib/components/ui/progress";
    import {
        Upload,
        Video,
        FileImage,
        X,
        LoaderCircle,
        CircleCheck,
        CircleAlert,
        Download,
        CloudDownload,
        FileText,
        CircleHelp,
        FileAudio,
        Image as ImageIcon,
    } from "@lucide/svelte";
    import {
        uploadFiles,
        downloadFileFromServer,
        downloadAllFilesFromServer,
        abortJob,
    } from "$lib/api.js";
    import { socket, joinJob, leaveJob } from "$lib/socket.js";
    import { auth } from "$lib/auth.svelte";
    import Navbar from "$lib/components/navbar.svelte";
    import { toast } from "svelte-sonner";

    let activeTab = $state("multimedia");
    let files = $state([]);
    let processingType = $state("VIDEO_RESIZE");
    let resolution = $state("480p");
    let isDragging = $state(false);
    let isLoading = $state(false);
    let isAborting = $state(false);
    let fileInput = $state(/** @type {HTMLInputElement | null} */ (null));

    // Job Progress Tracking
    /** @type {any} */
    let currentJob = $state(null);
    /** @type {Record<string, boolean>} */
    let downloadedUrls = $state({});

    let maxFiles = $derived(activeTab === "multimedia" ? 1 : 10);
    let canUpload = $derived(
        files.length > 0 &&
            files.length <= maxFiles &&
            !isLoading &&
            !isAborting,
    );

    function handleFileDrop(e) {
        e.preventDefault();
        isDragging = false;
        if (e.dataTransfer?.files) {
            addFiles(Array.from(e.dataTransfer.files));
        }
    }

    function handleFileSelect(e) {
        if (e.target?.files) {
            addFiles(Array.from(e.target.files));
        }
    }

    function addFiles(newFiles) {
        if (activeTab === "multimedia") {
            const validFiles = newFiles.filter(
                (file) =>
                    file.type.startsWith("video/") ||
                    file.type.startsWith("audio/"),
            );
            if (validFiles.length > 0) {
                files = [validFiles[0]];
            } else if (newFiles.length > 0) {
                console.warn("Invalid file type for multimedia");
            }
        } else {
            const validFiles = newFiles.filter((file) =>
                file.type.startsWith("image/"),
            );
            files = [...files, ...validFiles].slice(0, 10);
        }
    }

    function removeFile(index) {
        files = files.filter((_, i) => i !== index);
    }

    async function startProcess() {
        if (!canUpload) return;

        isLoading = true;
        try {
            console.log("Starting job:", { files, processingType, resolution });
            /** @type {any} */
            let uploadRes = await uploadFiles(
                files,
                activeTab,
                processingType,
                resolution,
            );

            if (uploadRes?.status && uploadRes?.jobId) {
                console.log("Upload success, jobId:", uploadRes.jobId);
                currentJob = {
                    jobId: uploadRes.jobId,
                    progress: 0,
                    status: "PENDING",
                    outputUrls: [],
                    error: null,
                };
                downloadedUrls = {};

                joinJob(uploadRes.jobId);

                files = [];
            } else {
                console.error("Upload failed or no jobId returned", uploadRes);
            }
        } catch (error) {
            console.error("Process failed:", error);
        } finally {
            isLoading = false;
        }
    }

    $effect(() => {
        const handleUpdate = (data) => {
            if (currentJob && data.jobId === currentJob.jobId) {
                console.log("Job update received:", data);
                currentJob = { ...currentJob, ...data };
            }
        };

        socket.on("job-update", handleUpdate);

        return () => {
            socket.off("job-update", handleUpdate);
        };
    });

    async function resetProcessor() {
        if (currentJob?.jobId) {
            if (
                currentJob.status === "PENDING" ||
                currentJob.status === "PROCESSING"
            ) {
                try {
                    isAborting = true;
                    await abortJob(currentJob.jobId);
                    toast.success("Job abortion signal sent");
                } catch (err) {
                    toast.error("Failed to abort job");
                } finally {
                    isAborting = false;
                }
            }
            leaveJob(currentJob.jobId);
        }
        currentJob = null;
        downloadedUrls = {};
    }

    function triggerFileInput() {
        fileInput?.click();
    }

    /** @param {string} fileUrl */
    async function handleDownload(fileUrl) {
        if (currentJob?.jobId) {
            await downloadFileFromServer(currentJob.jobId, fileUrl);
            downloadedUrls[fileUrl] = true;
        }
    }

    async function handleDownloadAll() {
        if (currentJob?.jobId) {
            await downloadAllFilesFromServer(currentJob.jobId);
            if (currentJob.outputUrls) {
                currentJob.outputUrls.forEach((url) => {
                    downloadedUrls[url] = true;
                });
            }
        }
    }

    /** @param {string} url */
    function getFileIcon(url) {
        const ext = url.split(".").pop()?.toLowerCase();
        if (["mp4", "mkv", "mov", "webm", "avi"].includes(ext)) return Video;
        if (["mp3", "wav", "ogg", "flac", "m4a"].includes(ext))
            return FileAudio;
        if (["jpg", "jpeg", "png", "webp", "svg"].includes(ext))
            return ImageIcon;
        if (["gif"].includes(ext)) return FileImage;
        if (["pdf", "docx", "txt"].includes(ext)) return FileText;
        return CircleHelp;
    }
</script>

<div class="min-h-screen bg-background text-foreground flex flex-col">
    <Navbar currentPath="/" />

    <main class="flex-1 flex flex-col items-center justify-center p-6">
        <div class="w-full max-w-3xl space-y-6">
            {#if !currentJob}
                <!-- Processor View -->
                <Tabs.Root bind:value={activeTab} class="w-full">
                    <Tabs.List class="grid w-full grid-cols-2 mb-4">
                        <Tabs.Trigger class="" value="multimedia"
                            >Multimedia Processing</Tabs.Trigger
                        >
                        <Tabs.Trigger class="" value="ocr"
                            >Document OCR</Tabs.Trigger
                        >
                    </Tabs.List>

                    <Card.Root class="">
                        <Card.Header class="">
                            <Card.Title class="">
                                {activeTab === "multimedia"
                                    ? "Video & Audio Tools"
                                    : "Image Text Extraction"}
                            </Card.Title>
                            <Card.Description class="">
                                {activeTab === "multimedia"
                                    ? "Upload a video or audio to resize, extract audio, or generate thumbnails."
                                    : "Upload up to 10 images for high-accuracy OCR processing."}
                            </Card.Description>
                        </Card.Header>

                        <Card.Content class="space-y-6">
                            <div
                                role="button"
                                tabindex="0"
                                aria-label="Upload files"
                                ondragover={(e) => {
                                    e.preventDefault();
                                    isDragging = true;
                                }}
                                ondragleave={() => (isDragging = false)}
                                ondrop={handleFileDrop}
                                onclick={triggerFileInput}
                                onkeydown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        triggerFileInput();
                                    }
                                }}
                                class="border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer
                                {isDragging
                                    ? 'border-primary bg-primary/5'
                                    : 'border-muted-foreground/20 bg-muted/20'}"
                            >
                                <Upload
                                    class="w-10 h-10 mb-4 text-muted-foreground"
                                />
                                <p class="text-sm font-medium text-center">
                                    Drag and drop or <span
                                        class="text-primary hover:underline"
                                        >browse files</span
                                    >
                                    <input
                                        bind:this={fileInput}
                                        type="file"
                                        class="hidden"
                                        multiple={activeTab === "ocr"}
                                        accept={activeTab === "multimedia"
                                            ? "video/*,audio/*"
                                            : "image/*"}
                                        onchange={handleFileSelect}
                                    />
                                </p>
                                <p class="text-xs text-muted-foreground mt-2">
                                    {activeTab === "multimedia"
                                        ? "Limit: 1 File (Video/Audio)"
                                        : "Limit: 10 Images"}
                                </p>
                            </div>

                            {#if files.length > 0}
                                <div class="space-y-2">
                                    {#each files as file, i}
                                        <div
                                            class="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border"
                                        >
                                            <div
                                                class="flex items-center gap-3"
                                            >
                                                {#if isLoading}
                                                    <LoaderCircle
                                                        class="w-5 h-5 animate-spin text-primary"
                                                    />
                                                {:else if activeTab === "multimedia"}
                                                    {#if file.type.startsWith("video/")}
                                                        <Video
                                                            class="w-5 h-5 text-blue-500"
                                                        />
                                                    {:else}
                                                        <FileAudio
                                                            class="w-5 h-5 text-purple-500"
                                                        />
                                                    {/if}
                                                {:else}
                                                    <FileImage
                                                        class="w-5 h-5 text-emerald-500"
                                                    />
                                                {/if}
                                                <span
                                                    class="text-sm truncate max-w-[200px]"
                                                    >{file.name}</span
                                                >
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onclick={() => removeFile(i)}
                                                disabled={isLoading}
                                            >
                                                <X class="w-4 h-4" />
                                            </Button>
                                        </div>
                                    {/each}
                                </div>
                            {/if}

                            <div
                                class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t"
                            >
                                {#if activeTab === "multimedia"}
                                    <div class="space-y-2">
                                        <Label class="">Operation Type</Label>
                                        <Select.Root
                                            type="single"
                                            bind:value={processingType}
                                            disabled={isLoading}
                                        >
                                            <Select.Trigger class="w-full"
                                                >{processingType.replace(
                                                    "_",
                                                    " ",
                                                )}</Select.Trigger
                                            >
                                            <Select.Content class="">
                                                <Select.Item
                                                    value="VIDEO_RESIZE"
                                                    >Video Resize</Select.Item
                                                >
                                                <Select.Item
                                                    value="AUDIO_EXTRACT"
                                                    >Audio Extraction</Select.Item
                                                >
                                                <Select.Item
                                                    value="VIDEO_THUMBNAILS"
                                                    >Thumbnails</Select.Item
                                                >
                                            </Select.Content>
                                        </Select.Root>
                                    </div>

                                    {#if processingType === "VIDEO_RESIZE"}
                                        <div class="space-y-2">
                                            <Label class=""
                                                >Target Resolution</Label
                                            >
                                            <Select.Root
                                                type="single"
                                                bind:value={resolution}
                                                disabled={isLoading}
                                            >
                                                <Select.Trigger class="w-full"
                                                    >{resolution}</Select.Trigger
                                                >
                                                <Select.Content class="">
                                                    <Select.Item value="1080p"
                                                        >1080p (Full HD)</Select.Item
                                                    >
                                                    <Select.Item value="720p"
                                                        >720p (HD)</Select.Item
                                                    >
                                                    <Select.Item value="480p"
                                                        >480p (SD)</Select.Item
                                                    >
                                                </Select.Content>
                                            </Select.Root>
                                        </div>
                                    {/if}
                                {:else}
                                    <div
                                        class="col-span-2 flex items-center justify-center p-4 border rounded-lg bg-muted/10 italic text-sm text-muted-foreground"
                                    >
                                        OCR processing will automatically detect
                                        text in all uploaded images.
                                    </div>
                                {/if}
                            </div>
                        </Card.Content>

                        <Card.Footer class="">
                            <Button
                                class="w-full py-6 text-lg cursor-pointer"
                                disabled={!canUpload}
                                onclick={startProcess}
                            >
                                {#if isLoading}
                                    <LoaderCircle
                                        class="w-5 h-5 mr-2 animate-spin"
                                    />
                                    Processing...
                                {:else}
                                    Process {files.length}
                                    {activeTab === "multimedia"
                                        ? "File"
                                        : "Images"}
                                {/if}
                            </Button>
                        </Card.Footer>
                    </Card.Root>
                </Tabs.Root>
            {:else}
                <!-- Progress Tracking View -->
                <Card.Root
                    class="border-primary/20 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500"
                >
                    <Card.Header class="pb-2">
                        <div class="flex items-center justify-between mb-2">
                            <Badge
                                class="bg-primary/10 text-primary hover:bg-primary/20 border-none px-3 py-1"
                            >
                                {currentJob.status}
                            </Badge>
                            <span
                                class="text-xs font-mono text-muted-foreground"
                                >ID: {currentJob.jobId}</span
                            >
                        </div>
                        <Card.Title class="text-2xl">Processing Job</Card.Title>
                        <Card.Description
                            >Tracking real-time progress of your requested
                            operations.</Card.Description
                        >
                    </Card.Header>

                    <Card.Content class="space-y-8 py-8">
                        <div class="space-y-4">
                            <div
                                class="flex items-center justify-between text-sm"
                            >
                                <span class="font-medium">Work Completion</span>
                                <span class="text-primary font-bold"
                                    >{currentJob.progress}%</span
                                >
                            </div>
                            <Progress
                                value={currentJob.progress}
                                max={100}
                                class="h-3 shadow-inner"
                            />

                            <div
                                class="flex items-center gap-3 text-sm p-4 bg-muted/30 rounded-lg border border-dashed"
                            >
                                {#if currentJob.status === "COMPLETED"}
                                    <div
                                        class="bg-emerald-500/10 p-2 rounded-full"
                                    >
                                        <CircleCheck
                                            class="w-5 h-5 text-emerald-500"
                                        />
                                    </div>
                                    <p
                                        class="font-medium text-emerald-600 dark:text-emerald-400"
                                    >
                                        Processing finished successfully!
                                    </p>
                                {:else if currentJob.error}
                                    <div
                                        class="bg-destructive/10 p-2 rounded-full"
                                    >
                                        <CircleAlert
                                            class="w-5 h-5 text-destructive"
                                        />
                                    </div>
                                    <p class="font-medium text-destructive">
                                        {currentJob.error}
                                    </p>
                                {:else}
                                    <LoaderCircle
                                        class="w-5 h-5 animate-spin text-primary"
                                    />
                                    <p class="text-muted-foreground">
                                        The worker nodes are currently handling
                                        your request...
                                    </p>
                                {/if}
                            </div>
                        </div>

                        {#if currentJob.outputUrls && currentJob.outputUrls.length > 0}
                            <div
                                class="space-y-4 pt-4 animate-in fade-in zoom-in-95 duration-700"
                            >
                                <div class="flex items-center justify-between">
                                    <h3
                                        class="font-semibold text-lg flex items-center gap-2"
                                    >
                                        Generated Assets
                                        <span
                                            class="bg-muted px-2 py-0.5 rounded text-xs font-normal"
                                            >{currentJob.outputUrls.length}
                                            items</span
                                        >
                                    </h3>
                                    {#if currentJob.outputUrls.length > 1}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onclick={handleDownloadAll}
                                            class="gap-2 h-8 text-xs cursor-pointer"
                                        >
                                            <CloudDownload class="w-4 h-4" />
                                            Download All (ZIP)
                                        </Button>
                                    {/if}
                                </div>
                                <div class="grid gap-3">
                                    {#each currentJob.outputUrls as url, i}
                                        {@const FileIcon = getFileIcon(url)}
                                        <button
                                            onclick={() => handleDownload(url)}
                                            class="w-full flex items-center justify-between p-4 bg-background border rounded-xl hover:border-primary hover:bg-primary/5 transition-all group cursor-pointer text-left {downloadedUrls[
                                                url
                                            ]
                                                ? 'opacity-80'
                                                : ''}"
                                        >
                                            <div
                                                class="flex items-center gap-3"
                                            >
                                                <div
                                                    class="bg-muted group-hover:bg-primary/10 p-2 rounded-lg transition-colors"
                                                >
                                                    <FileIcon
                                                        class="w-5 h-5 {downloadedUrls[
                                                            url
                                                        ]
                                                            ? 'text-emerald-500'
                                                            : 'text-primary'}"
                                                    />
                                                </div>
                                                <div class="flex flex-col">
                                                    <span
                                                        class="text-sm font-medium"
                                                        >Output Item #{i +
                                                            1}</span
                                                    >
                                                    <span
                                                        class="text-xs text-muted-foreground truncate max-w-[200px]"
                                                        >{url
                                                            .split("/")
                                                            .pop()}</span
                                                    >
                                                </div>
                                            </div>
                                            {#if downloadedUrls[url]}
                                                <CircleCheck
                                                    class="w-4 h-4 text-emerald-500 animate-in zoom-in duration-300"
                                                />
                                            {:else}
                                                <Download
                                                    class="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors"
                                                />
                                            {/if}
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </Card.Content>

                    <Card.Footer class="bg-muted/10 border-t pt-6">
                        <Button
                            variant={currentJob.status === "COMPLETED"
                                ? "default"
                                : "outline"}
                            class="w-full h-12 cursor-pointer"
                            onclick={resetProcessor}
                            disabled={isAborting}
                        >
                            {#if isAborting}
                                <LoaderCircle
                                    class="w-5 h-5 mr-2 animate-spin"
                                />
                                Aborting...
                            {:else}
                                {currentJob.status === "COMPLETED"
                                    ? "Start New Process"
                                    : "Cancel & Abort"}
                            {/if}
                        </Button>
                    </Card.Footer>
                </Card.Root>
            {/if}
        </div>
    </main>
</div>
