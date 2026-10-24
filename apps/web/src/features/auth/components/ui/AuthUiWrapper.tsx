import React from 'react';
import Sectionheader from './Sectionheader';
import ProviderButtons from './ProviderButtons';
import { useNavigate } from 'react-router';
import { cn } from 'cn';

const AuthUiWrapper = ({
    children,
    mode = 'sign-in',
}: {
    children: React.ReactNode;
    mode?: 'sign-in' | 'sign-up' | 'reset-password';
}) => {
    const navigate = useNavigate();
    const canGoBack = (window.history.state?.idx ?? 0) > 0;
    return (
        <div className="flex flex-col  h-screen w-full gap-5 ">
            <div className="pt-8 px-6">
                <button
                    onClick={() => navigate(-1)}
                    className={cn(
                        'clickable rounded-full bg-surface-primary p-2 text-fr-primary/70 hover:text-fr-primary smooth-300',
                        !canGoBack && 'invisible'
                    )}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="size-5"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 19.5 8.25 12l7.5-7.5"
                        />
                    </svg>
                </button>
            </div>
            <div className="flex items-center flex-col justify-center flex-1 h-full ">
                <Sectionheader mode={mode} />
                <div className="flex flex-col w-full items-center gap-3 max-w-sm">
                    {mode !== 'reset-password' && (
                        <ProviderButtons isSignUp={mode === 'sign-up'} />
                    )}

                    <div className="flex flex-col items-center gap-3 w-full">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthUiWrapper;
