<script>
    import "./layout.css";
    import favicon from "$lib/assets/favicon.svg";
    import { Toaster } from "svelte-sonner";
    import { getAuthStatus } from "$lib/api";
    import { auth } from "$lib/auth.svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/state";

    let { children } = $props();

    $effect(() => {
        getAuthStatus()
            .then((data) => {
                if (data.loggedIn && data.user) {
                    auth.user = data.user;
                } else {
                    auth.user = null;
                }
            })
            .catch((err) => {
                auth.user = null;
            })
            .finally(() => {
                auth.isInitialized = true;
            });
    });

    $effect(() => {
        if (auth.isInitialized) {
            const path = page.url.pathname;
            const isAuthRoute = path.startsWith("/auth");

            if (!auth.user && !isAuthRoute) {
                goto("/auth/login");
            } else if (auth.user && isAuthRoute) {
                goto("/");
            }
        }
    });
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<Toaster position="top-right" richColors />

{#if auth.isInitialized}
    {@render children()}
{:else}
    <div class="flex h-screen items-center justify-center">
        <div class="flex flex-col items-center gap-2">
            <div
                class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
            ></div>
            <p class="text-sm font-medium text-muted-foreground">
                Checking session...
            </p>
        </div>
    </div>
{/if}
