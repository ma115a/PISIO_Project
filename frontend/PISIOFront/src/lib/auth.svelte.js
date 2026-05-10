import { browser } from '$app/environment';
import { logout as apiLogout } from './api';

function createAuthStore() {
    let user = $state(null);
    let isInitialized = $state(false);

    return {
        get user() {
            return user;
        },
        set user(value) {
            user = value;
        },
        get isInitialized() {
            return isInitialized;
        },
        set isInitialized(value) {
            isInitialized = value;
        },
        async logout() {
            try {
                await apiLogout();
            } catch (err) {
            } finally {
                this.user = null;
                if (browser) {
                    window.location.href = '/auth/login';
                }
            }
        }
    };
}

export const auth = createAuthStore();
