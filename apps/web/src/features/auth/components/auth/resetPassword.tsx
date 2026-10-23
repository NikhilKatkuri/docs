import TextInput from '../../../../components/ui/TextInput';
import AuthUiWrapper from '../ui/AuthUiWrapper';

const ResetPasswordForm = () => {
    return (
        <AuthUiWrapper mode="reset-password">
            <div className="w-full">
                <TextInput
                    type="email"
                    placeholder="e.g., name@example.com"
                    shape="rounded"
                    variant="bordered"
                    className="px-5 py-3.5"
                />
            </div>

            <button className="w-full bg-sky/80 clickable hover:bg-sky smooth-300 p-3 rounded-full">
                <p className="">Continue</p>
            </button>
        </AuthUiWrapper>
    );
};

export default ResetPasswordForm;
