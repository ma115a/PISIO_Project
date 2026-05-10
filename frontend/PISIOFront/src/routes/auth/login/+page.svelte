<script>
    import LoginForm from "$lib/components/login-form.svelte";
    import { login } from "$lib/api";
    import { auth } from "$lib/auth.svelte";
    import { toast } from "svelte-sonner";

    let isLoading = $state(false);

    async function handleLogin({ email, password }) {
        isLoading = true;
        try {
            const response = await login(email, password);
            if (response.success) {
                toast.success(response.message || "Logged in successfully!");
                setTimeout(() => {
                    window.location.href = "/";
                }, 1000);
            }
        } catch (err) {
            toast.error(err.message || "Login failed");
        } finally {
            isLoading = false;
        }
    }
</script>

<div class="flex h-screen w-full items-center justify-center px-4">
    <LoginForm onlogin={handleLogin} {isLoading} />
</div>
