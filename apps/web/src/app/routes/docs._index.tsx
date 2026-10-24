import { signOutUser } from '../../lib/firebase';

const page = () => {
    return (
        <div className="h-screen w-screen flex items-center justify-center">
            <button className="" onClick={signOutUser}>
                Sign-out
            </button>
        </div>
    );
};

export default page;
