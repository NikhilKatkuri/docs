import {
    signInOrSignUpWithGithub,
    signInOrSignUpWithGoogle,
} from '../../../../lib/firebase';
import { useAuth } from '../../provider/AuthProvider';

const providerMethods = {
    google: signInOrSignUpWithGoogle,
    github: signInOrSignUpWithGithub,
};

type Provider = keyof typeof providerMethods;

const ProviderButtons = () => {
    const { makeAuth } = useAuth();
    return (
        <div className="flex flex-col gap-3 w-full">
            {(Object.keys(providerMethods) as Provider[]).map((provider) => {
                return (
                    <button
                        type="button"
                        key={provider}
                        onClick={() => makeAuth(providerMethods[provider])}
                        className="flex items-center p-3 justify-center gap-3 rounded-full bg-surface-primary hover:bg-bg-secondary smooth-300 clickable w-full  "
                    >
                        <img
                            src={`/vectors/${provider}.svg`}
                            alt={`${provider}-svg`}
                            className="h-5 w-5"
                        />
                        <p className="text-center">
                            Continue with{' '}
                            {provider.charAt(0).toUpperCase() +
                                provider.slice(1)}
                        </p>
                    </button>
                );
            })}
            <div className="flex items-center justify-center gap-4 w-full">
                <div className="w-full h-0.5 bg-bg-secondary rounded-full"></div>
                <p className="">Or</p>
                <div className="w-full h-0.5 bg-bg-secondary rounded-full"></div>
            </div>
        </div>
    );
};

export default ProviderButtons;
