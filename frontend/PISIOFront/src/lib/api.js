import { auth } from './auth.svelte';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function checkResponse(response) {
    if (response.status === 401) {
        auth.user = null;
        throw new Error('Unauthorized');
    }
    return response;
}

export async function getAuthStatus() {
    try {
        const response = await fetch(`${API_URL}/auth/status`, {
            headers: {
                'Accept': 'application/json'
            },
            credentials: 'include'
        });

        await checkResponse(response);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (err) {
        console.error("[API] /auth/status error:", err);
        throw err;
    }
}

export async function getUserHistory(page = 1, limit = 10) {
    try {
        const response = await fetch(`${API_URL}/api/jobs/history?page=${page}&limit=${limit}`, {
            headers: {
                'Accept': 'application/json'
            },
            credentials: 'include'
        });

        await checkResponse(response);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (err) {
        console.error("[API] getUserHistory error:", err);
        throw err;
    }
}

export async function register(displayName, email, password) {
    const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ displayName, email, password }),
        credentials: 'include'
    });

    // await checkResponse(response);

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
    }

    return await response.json();
}

export async function login(email, password) {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
    });

    // await checkResponse(response);

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
    }

    return await response.json();
}

export async function logout() {
    const response = await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
    });

    await checkResponse(response);

    if (!response.ok) {
        throw new Error('Logout failed');
    }

    return await response.json();
}

export async function abortJob(jobId) {
    try {
        const response = await fetch(`${API_URL}/jobs/abort/${jobId}`, {
            method: 'POST',
            credentials: 'include'
        });

        await checkResponse(response);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (err) {
        console.error("[API] abortJob error:", err);
        throw err;
    }
}

export async function uploadFiles(files, tab, type, resolution) {
    const formData = new FormData()
    let endpoint = ''

    if (tab === 'multimedia') {
        endpoint = `${API_URL}/upload/video`
        formData.append('file', files[0])
        formData.append('type', type)
        if (type === 'VIDEO_RESIZE' && resolution) {
            formData.append('resolution', resolution)
        }
    } else if (tab === 'ocr') {
        endpoint = `${API_URL}/upload/docs`
        files.forEach((file) => {
            formData.append('file', file)
        })
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        })

        await checkResponse(response);

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message)
        }
        return await response.json()
    } catch (err) {
        console.error(err)
        throw err;
    }
}

export async function downloadFileFromServer(jobId, fileUrl) {
    const downloadUrl = `${API_URL}/download/${jobId}?fileUrl=${encodeURIComponent(fileUrl)}`;

    try {
        const response = await fetch(downloadUrl, { credentials: 'include' });

        await checkResponse(response);

        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        const fileName = fileUrl.split('/').pop() || 'download';
        link.download = fileName;

        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Download error:", err);
        window.open(downloadUrl, '_blank');
    }
}

export async function downloadAllFilesFromServer(jobId) {
    const downloadUrl = `${API_URL}/download-all/${jobId}`;

    try {
        const response = await fetch(downloadUrl, { credentials: 'include' });

        await checkResponse(response);

        if (!response.ok) throw new Error('Zip download failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `job_${jobId}_results.zip`;

        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Zip download error:", err);
        window.open(downloadUrl, '_blank');
    }
}
