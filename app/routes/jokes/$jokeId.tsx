import { Joke } from "@prisma/client";
import {
    LoaderFunction,
    useLoaderData,
    Link,
    useParams,
    useCatch,
    MetaFunction,
} from "remix";
import { JokeDisplay } from "~/components/joke";
import { db } from "~/utils/db.server";
import { getUserId } from "~/utils/session.server";

type LoaderData = { joke: Joke; isOwner: boolean };

export const meta: MetaFunction = ({
    data,
}: {
    data: LoaderData | undefined;
}) => {
    if (!data) {
        return {
            title: "No joke",
            description: "No joke found",
        };
    }
    return {
        title: `"${data.joke.name}" joke`,
        description: `Enjoy the "${data.joke.name}" joke and much more`,
    };
};

export const loader: LoaderFunction = async ({
    params,
    request,
}): Promise<LoaderData> => {
    const userId = await getUserId(request);

    const joke = await db.joke.findUnique({
        where: { id: params.jokeId },
    });
    if (!joke) {
        throw new Response("What a joke! Not found.", { status: 404 });
    }

    return { joke, isOwner: userId === joke.jokesterId };
};

export default function JokeRoute() {
    const { joke, isOwner } = useLoaderData<LoaderData>();

    return <JokeDisplay joke={joke} isOwner={isOwner} />;
}

export function CatchBoundary() {
    const caught = useCatch();
    const params = useParams();
    if (caught.status === 404) {
        return (
            <div className="error-container">
                Huh? What the heck is "{params.jokeId}"?
            </div>
        );
    }
    throw new Error(`Unhandled error: ${caught.status}`);
}

export function ErrorBoundary() {
    const { jokeId } = useParams();
    return (
        <div className="error-container">{`There was an error loading joke by the id ${jokeId}. Sorry.`}</div>
    );
}
