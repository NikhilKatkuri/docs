import React from 'react';
import Sectionheader from './Sectionheader';
import ProviderButtons from './ProviderButtons';

const AuthUiWrapper = ({
    children,
    mode = 'sign-in',
}: {
    children: React.ReactNode;
    mode?: 'sign-in' | 'sign-up';
}) => {
    return (
        <div className="flex items-center flex-col justify-center flex-1 h-full ">
            <Sectionheader mode={mode} />
            <div className="flex flex-col w-full items-center gap-3 max-w-sm">
                <ProviderButtons />

                <div className="flex flex-col items-center gap-3 w-full">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default AuthUiWrapper;
