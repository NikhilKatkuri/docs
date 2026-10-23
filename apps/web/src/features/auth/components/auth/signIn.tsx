import TextInput, { PasswordInput } from '../../../../components/ui/TextInput';
import AuthUiWrapper from '../ui/AuthUiWrapper';
import { NavLink } from 'react-router';

const SignInForm = () => {
    return (
        <AuthUiWrapper>
            <div className="w-full">
                <TextInput
                    type="email"
                    placeholder="e.g., name@example.com"
                    shape="rounded"
                    variant="bordered"
                    className="px-5 py-3.5"
                />
            </div>
            <div className="w-full">
                <TextInput
                    type="text"
                    placeholder="your name"
                    shape="rounded"
                    variant="bordered"
                    className="px-5 py-3.5"
                />
            </div>

            <div className="w-full">
                <PasswordInput
                    placeholder="Create password"
                    shape="rounded"
                    variant="bordered"
                    className="px-5 py-3.5"
                />
            </div>
            <div className="w-full">
                <PasswordInput
                    placeholder="Confirm password"
                    shape="rounded"
                    variant="bordered"
                    className="px-5 py-3.5"
                />
            </div>

            <button className="w-full bg-sky/80 clickable hover:bg-sky smooth-300 p-3 rounded-full">
                <p className="">Continue</p>
            </button>
            <div className="text-center my-5">
                <p className="text-sm flex gap-2">
                    Don't have an account?
                    <NavLink
                        to="/auth/sign-up"
                        className="text-blue-600 underline-offset-4 underline"
                    >
                        Create one
                    </NavLink>
                </p>
            </div>
        </AuthUiWrapper>
    );
};

export default SignInForm;
