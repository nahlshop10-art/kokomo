export function getCustomDomain(env: any): string {
    let customDomain = env.R2_PUBLIC_DOMAIN || 'pub-e5254e3b24604306b8ea63f93412de76.r2.dev';
    return customDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function replaceUploadUrls(responseBody: string, env: any): string {
    const customDomain = getCustomDomain(env);
    if (customDomain) {
        return responseBody.replace(/"\/uploads\//g, `"https://${customDomain}/uploads/`);
    }
    return responseBody;
}

export function getOriginBase(env: any, requestOrigin: string): string {
    const customDomain = getCustomDomain(env);
    return customDomain ? `https://${customDomain}` : requestOrigin;
}
