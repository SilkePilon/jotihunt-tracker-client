import {Input} from '../components/ui/input';
import {Button} from '../components/ui/button';

import {Card, CardContent} from '../components/ui/card';
import {useAuth} from '../hooks/auth.hook';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {Controller, useForm} from 'react-hook-form';
import {useNavigate} from 'react-router';
import usePWA from 'react-pwa-install-prompt';
import {isMobile} from 'react-device-detect';
import {useTheme} from "@/hooks/theme.hook.ts";
import {cn} from "@/lib/utils.ts";
import {Field, FieldDescription, FieldError, FieldGroup, FieldLabel} from "@/components/ui/field.tsx";
import backgroundImage from '@/assets/images/background.webp';
import {GlobeIcon} from "lucide-react";
import {siGithub} from "simple-icons";

const FormSchema = z.object({
    email: z.string().email({message: 'Vul een geldig e-mailadres in.'}),
    password: z.string(),
});

export default function Login() {
    const {login} = useAuth();
    const navigate = useNavigate();
    const {isStandalone, isInstallPromptSupported, promptInstall} = usePWA();

    useTheme();

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    /**
     * Handle the login, references the auth hook.
     * Navigates to the dashboard if successful.
     */
    async function handleLogin(data: z.infer<typeof FormSchema>) {
        const success = await login(data.email, data.password);
        if (!success) {
            form.setError('password', {
                message: 'Ongeldig e-mailadres of wachtwoord.',
            });
            return;
        }

        navigate('/');

        if (isInstallPromptSupported && !isStandalone && isMobile) {
            promptInstall();
        }
    }

    return (
        <div className="bg-muted/40 flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
            <div className="w-full max-w-sm md:max-w-4xl">
                <div className={"flex flex-col gap-6"}>
                    <Card className="overflow-hidden p-0">
                        <CardContent className="grid p-0 md:grid-cols-2">
                            <form className="p-6 md:p-8" onSubmit={form.handleSubmit(handleLogin)}>
                                <FieldGroup>
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <h1 className="text-2xl font-bold">🦊 Jotihunt Tracker</h1>
                                        <p className="text-muted-foreground text-balance">
                                            Inloggen op je Jotihunt Tracker account
                                        </p>
                                    </div>
                                    <Controller
                                        control={form.control}
                                        name="email"
                                        render={({field, fieldState}) => (
                                            <Field data-invalid={fieldState.invalid}>
                                                <FieldLabel htmlFor="login-email">E-mailadres</FieldLabel>
                                                <Input {...field} id="login-email" type="email" required
                                                       aria-invalid={fieldState.invalid}
                                                       placeholder="jouwnaam@emailadres.nl"/>
                                                {fieldState.invalid && <FieldError errors={[fieldState.error]}/>}
                                            </Field>
                                        )}
                                    />
                                    <Controller
                                        control={form.control}
                                        name="password"
                                        render={({field, fieldState}) => (
                                            <Field data-invalid={fieldState.invalid}>
                                                <FieldLabel htmlFor="login-password">Wachtwoord</FieldLabel>
                                                <Input {...field} id="login-password" type="password" required
                                                       aria-invalid={fieldState.invalid}/>
                                                {fieldState.invalid && <FieldError errors={[fieldState.error]}/>}
                                            </Field>
                                        )}
                                    />
                                    <Field>
                                        <Button type="submit">Login</Button>
                                    </Field>
                                    <FieldDescription className="text-center text-balance">
                                        Geen account? Vraag de organisatie er een te maken!
                                    </FieldDescription>
                                </FieldGroup>
                            </form>
                            <div className="bg-muted relative hidden md:block">
                                <img
                                    src={backgroundImage}
                                    alt="Image"
                                    className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.3] dark:grayscale"
                                />
                            </div>
                        </CardContent>
                    </Card>
                    {/* Haal onderstaande alsjeblieft niet weg! Zo help je andere ook een beetje :)
                     Een groepsnaam kun je instellen via GROUP_NAME. */}
                    <FieldDescription className="px-6 text-center">
                        Ontwikkeling door Scouting Scherpenzeel e.o.<br/>
                        <a href={"https://scoutingscherpenzeel.nl"} target={"_blank"} rel={"noreferrer"}
                           className={cn("ml-2 underline underline-offset-2 inline-flex items-center gap-1")}>
                            <GlobeIcon className={"size-3"}/>
                            Website</a>
                        <a href={"https://github.com/ScoutingScherpenzeel"} target={"_blank"} rel={"noreferrer"}
                           className={cn("ml-2 underline underline-offset-2 inline-flex items-center gap-1")}>
                            <span className={"fill-muted-foreground size-3"}
                                  dangerouslySetInnerHTML={{__html: siGithub.svg}}></span>
                            GitHub</a>
                    </FieldDescription>
                </div>
            </div>
        </div>
    );
}
