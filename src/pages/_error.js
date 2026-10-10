import * as Sentry from "@sentry/nextjs";
import Error from "next/error";

function CustomErrorComponent(props) {
  return <Error statusCode={props.statusCode} />;
}

CustomErrorComponent.getInitialProps = async (contextData) => {
  // Awaited so Sentry has time to send the event before a serverless
  // function instance exits.
  await Sentry.captureUnderscoreErrorException(contextData);
  return Error.getInitialProps(contextData);
};

export default CustomErrorComponent;
