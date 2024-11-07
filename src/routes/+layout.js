export const prerender = false;
export const ssr = true;

export const load = ({ url }) => {
    return {
        url: url.pathname,
    };
};
