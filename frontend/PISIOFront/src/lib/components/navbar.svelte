<script>
    import { auth } from "$lib/auth.svelte";
    import { Button } from "$lib/components/ui/button/index.js";

    let { currentPath = "/" } = $props();
</script>

<nav class="border-b px-6 py-3 flex items-center justify-between bg-card">
    <div class="flex items-center gap-2">
        <a
            href="/"
            class="flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
            <div
                class="bg-primary w-8 h-8 rounded-lg flex items-center justify-center"
            >
                <span class="text-primary-foreground font-bold">P</span>
            </div>
            <span class="text-xl font-bold tracking-tight"
                >Video & Picture Processing</span
            >
        </a>
    </div>
    <div class="flex items-center gap-6 text-sm font-medium">
        <a
            href="/history"
            class="transition-colors {currentPath === '/history'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-primary'}">History</a
        >
        {#if auth.user}
            <div class="flex items-center gap-4 border-l pl-6">
                <div class="flex items-center gap-3">
                    {#if auth.user.image}
                        <img
                            src={auth.user.image}
                            alt={auth.user.displayName || "User"}
                            referrerpolicy="no-referrer"
                            class="w-8 h-8 rounded-full border border-primary/10 shadow-sm"
                        />
                    {:else}
                        <div
                            class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm text-primary font-bold text-xs uppercase"
                        >
                            {(auth.user.displayName ||
                                auth.user.email ||
                                "?")[0]}
                        </div>
                    {/if}
                    <span class="text-muted-foreground font-medium"
                        >{auth.user.displayName || auth.user.email}</span
                    >
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    class="text-xs h-8 hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                    onclick={() => auth.logout()}>Logout</Button
                >
            </div>
        {:else}
            <a
                href="/auth/login"
                class="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
                >Sign In</a
            >
        {/if}
    </div>
</nav>
