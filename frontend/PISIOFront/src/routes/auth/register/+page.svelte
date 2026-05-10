<script>
    import SignupForm from "$lib/components/signup-form.svelte";
    import { register } from "$lib/api";
    import { toast } from "svelte-sonner";

    let isLoading = $state(false);

    async function handleSignup({ name, email, password, confirmPassword }) {
        // if (password !== confirmPassword) {
        //     toast.error("Passwords do not match");
        //     return;
        // }

        isLoading = true;
        try {
            const response = await register(name, email, password);
            if (response.success) {
                toast.success("User created successfully!");
                setTimeout(() => {
                    window.location.href = "/auth/login";
                }, 1000);
            }
        } catch (err) {
            toast.error(err.message || "Registration failed");
        } finally {
            isLoading = false;
        }
    }
</script>

<div class="flex h-screen w-full items-center justify-center px-4">
    <SignupForm onsignup={handleSignup} {isLoading} />
</div>
