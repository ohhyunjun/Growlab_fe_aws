// Share only requests made for the same article with the same authentication token.
export const createArticleDetailRequest = (api, getToken) => {
    const pending = new Map();
    return (id) => {
        const token = getToken();
        const key = JSON.stringify([String(id), token || null]);
        if (pending.has(key)) return pending.get(key);

        const request = api.get(`/articles/${id}`, {
            // false explicitly prevents Axios from adding an Authorization header for guests.
            headers: { Authorization: token ? `Bearer ${token}` : false },
        });
        pending.set(key, request);
        const clear = () => {
            if (pending.get(key) === request) pending.delete(key);
        };
        request.then(clear, clear);
        return request;
    };
};
