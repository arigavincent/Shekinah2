import {createFileRoute} from "@tanstack/react-router";
import {forwardBackend} from "../lib/backend.server";
const handle=({request}:{request:Request})=>forwardBackend(request);
export const Route=createFileRoute("/api/$")({server:{handlers:{GET:handle,HEAD:handle,POST:handle,PUT:handle,PATCH:handle,DELETE:handle}}});
