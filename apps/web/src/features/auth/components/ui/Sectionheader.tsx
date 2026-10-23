const Sectionheader = ({ mode }: { mode: 'sign-in' | 'sign-up' }) => {
    return (
        <>
            <div className="flex flex-col  items-center gap-2">
                <img className="h-14 w-14" src="/logo.svg" alt="Docs logo" />
                <p className="font-medium text-lg">Docs</p>
            </div>
            <div className="my-6 flex flex-col gap-6">
                <p className="text-xl font-medium">
                    {mode === 'sign-in'
                        ? 'Log into your account'
                        : 'Create your account'}
                </p>
            </div>
        </>
    );
};

export default Sectionheader;
