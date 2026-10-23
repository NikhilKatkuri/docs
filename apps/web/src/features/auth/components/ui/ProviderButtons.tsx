const ProviderButtons = () => {
    return (
        <div className="flex flex-col gap-3 w-full">
            {['google', 'github'].map((provider) => {
                return (
                    <button
                        key={provider}
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
