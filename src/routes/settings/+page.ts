import type { PageLoad } from './$types';


export const load: PageLoad = async() => {
    const settings = {
        rotationTime: 7,
        quizzes: true,
        maxWC: 0,
        anonymous: false,
        guessname: false
    }

    return { settings };
}