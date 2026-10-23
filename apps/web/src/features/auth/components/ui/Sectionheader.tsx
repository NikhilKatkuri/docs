const Sectionheader = ({
    mode,
}: {
    mode: 'sign-in' | 'sign-up' | 'reset-password';
}) => {
    const getHeaderText = () => {
        switch (mode) {
            case 'sign-in':
                return 'Log into your account';
            case 'sign-up':
                return 'Create your account';
            case 'reset-password':
                return 'Reset your password';
            default:
                return '';
        }
    };
    const headerText = getHeaderText();
    return (
        <>
            <div className="flex flex-col  items-center gap-2">
                <img className="h-14 w-14" src="/logo.svg" alt="Docs logo" />
                <p className="font-medium text-lg">Docs</p>
            </div>
            <div className="my-6 flex flex-col gap-6">
                <p className="text-xl font-medium">{headerText}</p>
            </div>
        </>
    );
};

export default Sectionheader;
