<script>
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { LoaderCircle } from "@lucide/svelte";

    let { onsignup, isLoading = false, ...restProps } = $props();

    let name = $state("");
    let email = $state("");
    let password = $state("");
    let confirmPassword = $state("");
    let confirmInput = $state(null);

    $effect(() => {
        if (confirmInput) {
            if (password !== confirmPassword && confirmPassword !== "") {
                confirmInput.setCustomValidity("Passwords do not match");
            } else {
                confirmInput.setCustomValidity("");
            }
        }
    });

    function handleSubmit(e) {
        e.preventDefault();
        if (password !== confirmPassword) {
            confirmInput.reportValidity();
            return;
        }
        onsignup({ name, email, password, confirmPassword });
    }
</script>

<Card.Root class="mx-auto w-full max-w-xl" {...restProps}>
    <Card.Header>
        <Card.Title class="text-2xl">Create an account</Card.Title>
        <Card.Description>
            Enter your information below to create your account
        </Card.Description>
    </Card.Header>
    <Card.Content>
        <form onsubmit={handleSubmit} class="space-y-6">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="grid gap-2 sm:col-span-2">
                    <Label for="name">Full Name</Label>
                    <Input
                        id="name"
                        type="text"
                        placeholder="John Doe"
                        bind:value={name}
                        required
                    />
                </div>
                <div class="grid gap-2 sm:col-span-2">
                    <Label for="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="m@example.com"
                        bind:value={email}
                        required
                    />
                </div>
                <div class="grid gap-2">
                    <Label for="password">Password</Label>
                    <Input
                        id="password"
                        type="password"
                        placeholder="••••••••••"
                        bind:value={password}
                        required
                    />
                </div>
                <div class="grid gap-2">
                    <Label for="confirm-password">Confirm Password</Label>
                    <Input
                        id="confirm-password"
                        type="password"
                        placeholder="••••••••••"
                        bind:value={confirmPassword}
                        bind:ref={confirmInput}
                        required
                    />
                </div>
            </div>

            <div class="grid gap-4">
                <Button
                    type="submit"
                    class="w-full cursor-pointer"
                    disabled={isLoading}
                >
                    {#if isLoading}
                        <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                    {:else}
                        Create Account
                    {/if}
                </Button>
                <Button
                    variant="outline"
                    type="button"
                    class="w-full cursor-pointer"
                    onclick={() =>
                        (window.location.href =
                            "http://localhost:5000/auth/google")}
                >
                    <svg
                        class="mr-2 h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                    >
                        <path
                            d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                            fill="currentColor"
                        />
                    </svg>
                    Sign up with Google
                </Button>
            </div>
            <div class="mt-4 text-center text-sm">
                Already have an account?
                <a href="/auth/login" class="underline underline-offset-4">
                    Sign in
                </a>
            </div>
        </form>
    </Card.Content>
</Card.Root>
