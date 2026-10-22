import { signInWithGoogle } from '../lib/firebase/functions';

const page = () => {
    return (
        <div className="h-screen w-screen flex items-center justify-center">
            <button
                className="px-4 py-3 rounded-md bg-sky-300 text-white font-semibold hover:bg-sky-400 transition-colors"
                onClick={signInWithGoogle}
            >
                Sign in with Google
            </button>
        </div>
    );
};

export default page;
